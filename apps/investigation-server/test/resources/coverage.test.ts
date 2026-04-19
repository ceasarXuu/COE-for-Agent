import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('legacy coverage resource', () => {
  const adminPool = createAdminPool();

  beforeAll(async () => {
    await assertServerTestDatabaseAvailable(adminPool);
  });

  beforeEach(async () => {
    await resetServerTestDatabase(adminPool);
  });

  afterAll(async () => {
    await adminPool.end();
  });

  test('is no longer exposed after canonical graph migration', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'coverage-removed-open',
        title: 'Removed coverage resource',
        objective: 'Ensure the legacy coverage resource is unavailable',
        severity: 'medium',
        projectDirectory: '/workspace/coverage-removed-open'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      await expect(
        app.mcpServer.readResource(`investigation://cases/${caseId}/coverage`)
      ).rejects.toThrow(/Unknown resource/);
    } finally {
      await app.close();
    }
  });
});
