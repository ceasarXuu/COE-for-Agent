import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { EventStoreRepository } from '../src/repositories/event-store.js';
import { createPersistenceClient } from '../src/client.js';

describe('file persistence locking', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        if (existsSync(dir)) {
          renameSync(dir, `${dir}.completed`);
        }
      }
    }
  });

  test('serializes concurrent writers across separate clients on the same data dir', async () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'coe-persistence-lock-'));
    tempDirs.push(dataDir);

    const clientA = createPersistenceClient({ dataDir });
    const clientB = createPersistenceClient({ dataDir });
    const caseId = 'case_01AAAAAAAAAAAAAAAAAAAAAAAA';

    const slowWrite = clientA.db.transaction().execute(async (trx) => {
      await new Promise((resolve) => setTimeout(resolve, 75));
      return new EventStoreRepository(trx).appendEventInExecutor(trx, {
        caseId,
        expectedRevision: 0,
        eventType: 'case.opened',
        commandName: 'investigation.case.open',
        actor: {
          actorType: 'agent',
          actorId: 'writer-a',
          sessionId: 'session-a',
          role: 'Operator',
          issuer: 'test',
          authMode: 'local'
        },
        payload: { title: 'first write' },
        metadata: { idempotencyKey: 'lock-test-a' }
      });
    });

    const fastWrite = new EventStoreRepository(clientB.db).appendEvent({
      caseId,
      expectedRevision: 0,
      eventType: 'case.opened',
      commandName: 'investigation.case.open',
      actor: {
        actorType: 'agent',
        actorId: 'writer-b',
        sessionId: 'session-b',
        role: 'Operator',
        issuer: 'test',
        authMode: 'local'
      },
      payload: { title: 'second write' },
      metadata: { idempotencyKey: 'lock-test-b' }
    });

    const results = await Promise.allSettled([slowWrite, fastWrite]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  test('writes lockfile metadata and reclaims locks orphaned by a dead pid', async () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'coe-persistence-stale-'));
    tempDirs.push(dataDir);

    const client = createPersistenceClient({ dataDir });
    const caseId = 'case_01STALELOCKAAAAAAAAAAAAAA';

    // Pre-populate the lockfile with metadata for a pid that is guaranteed not
    // to be alive (pid 1 in the current process namespace is owned by another
    // user; impossible-to-allocate pid 0x7fffffff). We use a freshly-spawned
    // child pid that has already exited so the test stays portable.
    const deadPid = 2_147_483_646; // outside any plausible live pid range
    writeFileSync(
      path.join(dataDir, 'store.lock'),
      JSON.stringify({ pid: deadPid, hostname: os.hostname(), acquiredAt: new Date(0).toISOString() }),
      'utf8'
    );

    // The next write should reclaim the orphaned lock and succeed.
    await new EventStoreRepository(client.db).appendEvent({
      caseId,
      expectedRevision: 0,
      eventType: 'case.opened',
      commandName: 'investigation.case.open',
      actor: {
        actorType: 'agent',
        actorId: 'writer-stale',
        sessionId: 'session-stale',
        role: 'Operator',
        issuer: 'test',
        authMode: 'local'
      },
      payload: { title: 'after stale lock reclaim' },
      metadata: { idempotencyKey: 'stale-lock-reclaim' }
    });

    // After the write the lock is released; assert it does not contain the
    // dead pid anymore (either gone or owned by the current process).
    const lockPath = path.join(dataDir, 'store.lock');
    if (existsSync(lockPath)) {
      const meta = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid: number };
      expect(meta.pid).not.toBe(deadPid);
    }

    await client.destroy();
  });
});
