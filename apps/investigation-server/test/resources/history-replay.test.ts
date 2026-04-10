import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { CheckpointRepository } from '@coe/persistence';
import { buildReplayScenario } from '../support/resource-scenarios.js';

describe.sequential('history replay resources', () => {
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

  test('replays snapshot and graph resources at a historical revision', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildReplayScenario(app);
      const snapshot = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/snapshot?atRevision=1`
      );
      const graph = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/graph?atRevision=2`
      );

      expect(snapshot.data).toMatchObject({
        headRevision: 3,
        projectionRevision: 1,
        requestedRevision: 1,
        historical: true,
        data: {
          counts: {
            symptoms: 0
          }
        }
      });

      const graphNodeIds = new Set(((graph.data as { data: { nodes: Array<{ id: string }> } }).data.nodes).map((node) => node.id));
      expect(graph.data).toMatchObject({
        headRevision: 3,
        projectionRevision: 2,
        requestedRevision: 2,
        historical: true
      });
      expect(graphNodeIds.has(scenario.symptomId)).toBe(true);
      expect(graphNodeIds.has(scenario.hypothesisId)).toBe(false);
    } finally {
      await app.close();
    }
  });

  test('normalizes negative revisions and persists a replay checkpoint after historical reads', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildReplayScenario(app);
      const timeline = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/timeline?atRevision=-1`
      );
      await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/snapshot?atRevision=1`
      );

      const checkpoint = await new CheckpointRepository(app.services.db).loadNearest(scenario.caseId, 1);

      expect(timeline.data).toMatchObject({
        headRevision: 3,
        projectionRevision: 0,
        requestedRevision: 0,
        historical: true,
        data: {
          events: []
        }
      });
      expect(checkpoint).toMatchObject({
        caseId: scenario.caseId,
        revision: 1
      });
    } finally {
      await app.close();
    }
  });
});
