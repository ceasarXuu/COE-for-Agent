import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildGraphScenario } from '../support/resource-scenarios.js';

describe.sequential('graph resource', () => {
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

  test('returns a local graph slice around the focused node', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildGraphScenario(app);
      const graph = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/graph?focusId=${scenario.focusHypothesisId}`
      );

      expect(graph.data).toMatchObject({
        data: {
          focusId: scenario.focusHypothesisId,
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: scenario.focusHypothesisId, kind: 'hypothesis' }),
            expect.objectContaining({
              id: scenario.focusSymptomId,
              kind: 'symptom',
              displayKind: 'symptom',
              issueKind: 'symptom'
            }),
            expect.objectContaining({ id: scenario.focusExperimentId, kind: 'experiment' })
          ]),
          edges: expect.arrayContaining([
            expect.objectContaining({ type: 'explains', fromId: scenario.focusHypothesisId, toId: scenario.focusSymptomId }),
            expect.objectContaining({ type: 'tests', fromId: scenario.focusExperimentId, toId: scenario.focusHypothesisId })
          ])
        }
      });

      const nodeIds = new Set(((graph.data as { data: { nodes: Array<{ id: string }> } }).data.nodes).map((node) => node.id));
      expect(nodeIds.has(scenario.unrelatedHypothesisId)).toBe(false);
      expect(nodeIds.has(scenario.unrelatedSymptomId)).toBe(false);
    } finally {
      await app.close();
    }
  });
});
