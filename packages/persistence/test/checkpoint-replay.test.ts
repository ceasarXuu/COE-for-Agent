import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { CheckpointRepository } from '../src/repositories/checkpoints.js';
import { EventStoreRepository } from '../src/repositories/event-store.js';
import { assertPostgresAvailable, createAdminPool, resetTestDatabase, TEST_DATABASE_URL } from './test-db.js';

describe.sequential('checkpoint replay', () => {
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

  test('loads nearest checkpoint and remaining events for replay', async () => {
    const persistence = createPersistenceClient({ connectionString: TEST_DATABASE_URL });
    await migrateToLatest(persistence.db);

    const eventStore = new EventStoreRepository(persistence.db);
    const checkpoints = new CheckpointRepository(persistence.db);
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
      payload: { title: 'case opened' },
      metadata: { idempotencyKey: 'idem-001' }
    });
    await eventStore.appendEvent({
      caseId,
      expectedRevision: 1,
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
      payload: { statement: 'symptom captured' },
      metadata: { idempotencyKey: 'idem-002' }
    });

    await checkpoints.save({
      caseId,
      revision: 2,
      projectionState: {
        snapshot: {
          nodeCount: 2
        }
      }
    });

    await eventStore.appendEvent({
      caseId,
      expectedRevision: 2,
      eventType: 'fact.asserted',
      commandName: 'investigation.fact.assert',
      actor: {
        actorType: 'agent',
        actorId: 'copilot',
        sessionId: 'session-1',
        role: 'Operator',
        issuer: 'local-dev',
        authMode: 'local'
      },
      payload: { statement: 'fact one' },
      metadata: { idempotencyKey: 'idem-003' }
    });
    await eventStore.appendEvent({
      caseId,
      expectedRevision: 3,
      eventType: 'decision.recorded',
      commandName: 'investigation.decision.record',
      actor: {
        actorType: 'agent',
        actorId: 'copilot',
        sessionId: 'session-1',
        role: 'Operator',
        issuer: 'local-dev',
        authMode: 'local'
      },
      payload: { statement: 'decision recorded' },
      metadata: { idempotencyKey: 'idem-004' }
    });

    const checkpoint = await checkpoints.loadNearest(caseId, 4);
    const replayEvents = await eventStore.listForReplay({
      caseId,
      fromRevisionExclusive: checkpoint?.revision ?? 0,
      toRevisionInclusive: 4
    });

    expect(checkpoint).toMatchObject({
      caseId,
      revision: 2,
      projectionState: {
        snapshot: {
          nodeCount: 2
        }
      }
    });
    expect(replayEvents.map((event) => event.caseRevision)).toEqual([3, 4]);

    await persistence.destroy();
  });
});