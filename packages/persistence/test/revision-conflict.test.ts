import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { RevisionConflict } from '@coe/domain';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { EventStoreRepository } from '../src/repositories/event-store.js';
import { assertPostgresAvailable, createAdminPool, resetTestDatabase, TEST_DATABASE_URL } from './test-db.js';

describe.sequential('revision conflict', () => {
  const adminPool = createAdminPool();

  beforeAll(async () => {
    await assertPostgresAvailable(adminPool);
  });

  beforeEach(async () => {
    await resetTestDatabase(adminPool);
  });

  afterAll(async () => {
    await adminPool.end();
  });

  test('rejects append when expected revision does not match current revision', async () => {
    const persistence = createPersistenceClient({ connectionString: TEST_DATABASE_URL });
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
        eventType: 'symptom.reported',
        commandName: 'investigation.symptom.report',
        actor: {
          actorType: 'agent',
          actorId: 'copilot',
          sessionId: 'session-1',
          role: 'Operator',
          issuer: 'local-dev',
          authMode: 'local'
        },
        payload: { statement: 'still broken' },
        metadata: { idempotencyKey: 'idem-002' }
      })
    ).rejects.toBeInstanceOf(RevisionConflict);

    await persistence.destroy();
  });
});