import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createPersistenceClient } from '../src/client.js';
import { migrateToLatest } from '../src/migrate.js';
import { CommandDedupRepository } from '../src/repositories/dedup.js';
import { assertPostgresAvailable, createAdminPool, resetTestDatabase, TEST_DATABASE_URL } from './test-db.js';

describe.sequential('command dedup', () => {
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

  test('returns existing record for repeated idempotency key', async () => {
    const persistence = createPersistenceClient({ connectionString: TEST_DATABASE_URL });
    await migrateToLatest(persistence.db);

    const dedup = new CommandDedupRepository(persistence.db);
    const first = await dedup.record({
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      toolName: 'investigation.hypothesis.create',
      idempotencyKey: 'idem-001',
      eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA'
    });
    const second = await dedup.record({
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      toolName: 'investigation.hypothesis.create',
      idempotencyKey: 'idem-001',
      eventId: 'evt_01BBBBBBBBBBBBBBBBBBBBBBBB'
    });

    expect(first).toEqual({
      duplicate: false,
      eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA'
    });
    expect(second).toEqual({
      duplicate: true,
      eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA'
    });

    await persistence.destroy();
  });

  test('claims a key once and returns the stored command result for duplicates', async () => {
    const persistence = createPersistenceClient({ connectionString: TEST_DATABASE_URL });
    await migrateToLatest(persistence.db);

    const dedup = new CommandDedupRepository(persistence.db);
    const claim = await dedup.claim({
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      toolName: 'investigation.hypothesis.create',
      idempotencyKey: 'idem-claim-001'
    });

    expect(claim).toEqual({
      claimed: true
    });

    await dedup.complete({
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      toolName: 'investigation.hypothesis.create',
      idempotencyKey: 'idem-claim-001',
      eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA',
      commandResult: {
        ok: true,
        eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA',
        createdIds: ['hypothesis_01AAAAAAAAAAAAAAAAAAA'],
        headRevisionBefore: 2,
        headRevisionAfter: 3,
        projectionScheduled: false,
        warnings: [],
        violations: []
      }
    });

    const duplicate = await dedup.claim({
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      toolName: 'investigation.hypothesis.create',
      idempotencyKey: 'idem-claim-001'
    });

    expect(duplicate).toEqual({
      claimed: false,
      eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA',
      commandResult: {
        ok: true,
        eventId: 'evt_01AAAAAAAAAAAAAAAAAAAAAAAA',
        createdIds: ['hypothesis_01AAAAAAAAAAAAAAAAAAA'],
        headRevisionBefore: 2,
        headRevisionAfter: 3,
        projectionScheduled: false,
        warnings: [],
        violations: []
      }
    });

    await persistence.destroy();
  });
});
