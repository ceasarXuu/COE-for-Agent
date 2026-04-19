import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildDiffScenario } from '../support/resource-scenarios.js';

describe.sequential('legacy panel resources', () => {
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

  test('are no longer exposed once the canonical graph inspector owns node detail reads', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildDiffScenario(app);

      await expect(
        app.mcpServer.readResource(
          `investigation://cases/${scenario.caseId}/hypotheses/${scenario.hypothesisId}?atRevision=3`
        )
      ).rejects.toThrow(/Unknown resource/);

      await expect(
        app.mcpServer.readResource(
          `investigation://cases/${scenario.caseId}/inquiries/${scenario.inquiryId}?atRevision=2`
        )
      ).rejects.toThrow(/Unknown resource/);
    } finally {
      await app.close();
    }
  });
});
