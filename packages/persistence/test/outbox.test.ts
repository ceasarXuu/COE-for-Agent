import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { ProjectionOutboxRepository } from '../src/repositories/outbox.js';
import { assertPostgresAvailable, createAdminPool, resetTestDatabase, TEST_DATABASE_URL } from './test-db.js';

describe.sequential('projection outbox', () => {
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

  test('claims tasks idempotently and recovers after failure', async () => {
    const persistence = createPersistenceClient({ connectionString: TEST_DATABASE_URL });
    await migrateToLatest(persistence.db);

    const outbox = new ProjectionOutboxRepository(persistence.db);
    const enqueued = await outbox.enqueue({
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      headRevision: 4,
      eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA',
      taskType: 'case.graph'
    });

    const firstClaim = await outbox.claimNext({
      workerId: 'worker-a',
      taskType: 'case.graph'
    });
    const secondClaim = await outbox.claimNext({
      workerId: 'worker-b',
      taskType: 'case.graph'
    });

    expect(firstClaim).toMatchObject({
      outboxId: enqueued.outboxId,
      taskType: 'case.graph',
      attemptCount: 1,
      status: 'processing'
    });
    expect(secondClaim).toBeNull();

    await outbox.markFailed({
      outboxId: enqueued.outboxId,
      errorMessage: 'temporary issue'
    });

    const retryClaim = await outbox.claimNext({
      workerId: 'worker-c',
      taskType: 'case.graph'
    });
    expect(retryClaim).toMatchObject({
      outboxId: enqueued.outboxId,
      attemptCount: 2,
      status: 'processing'
    });

    await persistence.destroy();
  });
});