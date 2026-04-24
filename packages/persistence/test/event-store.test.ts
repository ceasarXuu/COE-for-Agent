import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { EventStoreRepository } from '../src/repositories/event-store.js';
import {
  assertLocalPersistenceAvailable,
  createLocalPersistenceTestHandle,
  getTestDataDir,
  resetLocalPersistenceDataDir
} from './test-db.js';

describe.sequential('event store', () => {
  const persistenceTestHandle = createLocalPersistenceTestHandle();

  beforeAll(async () => {
    await assertLocalPersistenceAvailable(persistenceTestHandle);
  });

  beforeEach(async () => {
    await resetLocalPersistenceDataDir(persistenceTestHandle);
  });

  afterAll(async () => {
    await persistenceTestHandle.end();
  });

  test('appends event and returns next case revision', async () => {
    const persistence = createPersistenceClient({ dataDir: getTestDataDir() });
    await migrateToLatest(persistence.db);

    const eventStore = new EventStoreRepository(persistence.db);
    const caseId = 'case_01AAAAAAAAAAAAAAAAAAAAAAAA';
    const result = await eventStore.appendEvent({
      caseId,
      expectedRevision: 0,
      eventType: 'case.opened',
      commandName: 'investigation.case.open',
      actor: {
        actorType: 'agent',
        actorId: 'copilot',
        sessionId: 'session-1',
        role: 'Operator',
        issuer: 'local-dev',
        authMode: 'local'
      },
      payload: {
        title: 'Cache invalidation issue'
      },
      metadata: {
        idempotencyKey: randomUUID()
      }
    });

    expect(result.caseRevision).toBe(1);

    const rows = await eventStore.listCaseEvents(caseId);
    expect(rows.map((row) => ({
      case_revision: row.caseRevision,
      event_type: row.eventType,
      command_name: row.commandName
    }))).toEqual([
      {
        case_revision: 1,
        event_type: 'case.opened',
        command_name: 'investigation.case.open'
      }
    ]);

    await persistence.destroy();
  });
});
