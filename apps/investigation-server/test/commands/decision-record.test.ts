import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('decision.record command', () => {
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

  test('rejects decision.record without supporting facts or experiments', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'decision-open-001',
        title: 'Citationless decision',
        objective: 'Verify decision citations are required',
        severity: 'high',
        projectDirectory: '/workspace/decision-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      await expect(
        app.mcpServer.invokeTool('investigation.decision.record', {
          idempotencyKey: 'decision-record-001',
          caseId,
          ifCaseRevision: 1,
          title: 'declare ready to patch',
          decisionKind: 'ready_to_patch',
          statement: 'the evidence is sufficient'
        })
      ).rejects.toThrow(/supportingFactIds|supportingExperimentIds/i);
    } finally {
      await app.close();
    }
  });

  test('records a decision with supporting fact citations and writes it to the timeline', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'decision-open-002',
        title: 'Patch readiness decision',
        objective: 'Capture the decision with citations',
        severity: 'critical',
        projectDirectory: '/workspace/decision-open-002'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const artifact = await app.mcpServer.invokeTool('investigation.artifact.attach', {
        idempotencyKey: 'decision-artifact-001',
        caseId,
        ifCaseRevision: 1,
        artifactKind: 'log',
        title: 'retry trace',
        source: {
          uri: 'file:///tmp/retry-trace.log'
        },
        excerpt: 'retry branch emitted two capture attempts'
      });
      const artifactId = artifact.createdIds?.find((value) => value.startsWith('artifact_'))!;

      const fact = await app.mcpServer.invokeTool('investigation.fact.assert', {
        idempotencyKey: 'decision-fact-001',
        caseId,
        ifCaseRevision: 2,
        statement: 'retry branch executes twice for the same delivery',
        factKind: 'direct_observation',
        polarity: 'positive',
        sourceArtifactIds: [artifactId]
      });
      const factId = fact.createdIds?.find((value) => value.startsWith('fact_'))!;

      const decision = await app.mcpServer.invokeTool('investigation.decision.record', {
        idempotencyKey: 'decision-record-002',
        caseId,
        ifCaseRevision: 3,
        title: 'ready to patch retry guard',
        decisionKind: 'ready_to_patch',
        statement: 'the duplicate path is proven and can be patched',
        supportingFactIds: [factId]
      });
      const decisionId = decision.createdIds?.find((value) => value.startsWith('decision_'))!;

      expect(decision).toMatchObject({
        ok: true,
        createdIds: expect.arrayContaining([decisionId]),
        headRevisionAfter: 4
      });

      const timeline = await app.mcpServer.readResource(`investigation://cases/${caseId}/timeline`);
      expect(timeline.data).toMatchObject({
        data: {
          events: expect.arrayContaining([
            expect.objectContaining({
              eventType: 'decision.recorded'
            })
          ])
        }
      });
    } finally {
      await app.close();
    }
  });
});
