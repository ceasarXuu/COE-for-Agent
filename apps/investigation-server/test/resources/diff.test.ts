import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildDiffScenario } from '../support/resource-scenarios.js';

describe.sequential('diff resource', () => {
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

  test('returns changed nodes and state transitions between revisions', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildDiffScenario(app);
      const diff = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/diff?fromRevision=2&toRevision=3`
      );

      expect(diff.data).toMatchObject({
        data: {
          fromRevision: 2,
          toRevision: 3,
          changedNodeIds: expect.arrayContaining([scenario.hypothesisId]),
          stateTransitions: expect.arrayContaining([
            expect.objectContaining({
              nodeId: scenario.hypothesisId,
              kind: 'hypothesis',
              fromStatus: 'unverified',
              toStatus: 'confirmed'
            })
          ])
        }
      });
    } finally {
      await app.close();
    }
  });
});
