import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildDiffScenario } from '../support/resource-scenarios.js';

describe.sequential('panel resources history mode', () => {
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

  test('replays hypothesis and inquiry panels at a historical revision', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildDiffScenario(app);

      const hypothesisPanel = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/hypotheses/${scenario.hypothesisId}?atRevision=3`
      );
      const inquiryPanel = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/inquiries/${scenario.inquiryId}?atRevision=2`
      );

      expect(hypothesisPanel.data).toMatchObject({
        headRevision: 4,
        projectionRevision: 3,
        requestedRevision: 3,
        historical: true,
        data: {
          hypothesis: {
            id: scenario.hypothesisId,
            status: 'proposed'
          }
        }
      });

      expect(inquiryPanel.data).toMatchObject({
        headRevision: 4,
        projectionRevision: 2,
        requestedRevision: 2,
        historical: true,
        data: {
          inquiry: {
            id: scenario.inquiryId
          },
          hypotheses: []
        }
      });
    } finally {
      await app.close();
    }
  });
});