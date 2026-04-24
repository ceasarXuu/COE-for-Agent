import { existsSync, mkdtempSync, renameSync } from 'node:fs';
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
});
