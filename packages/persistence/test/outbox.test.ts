import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { ProjectionOutboxRepository } from '../src/repositories/outbox.js';
import {
  assertLocalPersistenceAvailable,
  createLocalPersistenceTestHandle,
  getTestDataDir,
  resetLocalPersistenceDataDir
} from './test-db.js';

describe.sequential('projection outbox', () => {
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

  test('claims tasks idempotently and recovers after failure', async () => {
    const persistence = createPersistenceClient({ dataDir: getTestDataDir() });
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
