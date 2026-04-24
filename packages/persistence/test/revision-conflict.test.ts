import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { RevisionConflict } from '@coe/domain';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { EventStoreRepository } from '../src/repositories/event-store.js';
import {
  assertLocalPersistenceAvailable,
  createLocalPersistenceTestHandle,
  getTestDataDir,
  resetLocalPersistenceDataDir
} from './test-db.js';

describe.sequential('revision conflict', () => {
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

  test('rejects append when expected revision does not match current revision', async () => {
    const persistence = createPersistenceClient({ dataDir: getTestDataDir() });
    await migrateToLatest(persistence.db);

    const eventStore = new EventStoreRepository(persistence.db);
    const caseId = 'case_01AAAAAAAAAAAAAAAAAAAAAAAA';

    await eventStore.appendEvent({
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
      payload: { title: 'first write' },
      metadata: { idempotencyKey: 'idem-001' }
    });

    await expect(
      eventStore.appendEvent({
        caseId,
        expectedRevision: 0,
        eventType: 'canonical.hypothesis.created',
        commandName: 'investigation.hypothesis.create',
        actor: {
          actorType: 'agent',
          actorId: 'copilot',
          sessionId: 'session-1',
          role: 'Operator',
          issuer: 'local-dev',
          authMode: 'local'
        },
        payload: { hypothesisId: 'hypothesis_01AAAAAAAAAAAAAAAAAAA', parentNodeId: 'problem_01AAAAAAAAAAAAAAAAAAAAA', statement: 'still broken' },
        metadata: { idempotencyKey: 'idem-002' }
      })
    ).rejects.toBeInstanceOf(RevisionConflict);

    await persistence.destroy();
  });
});
