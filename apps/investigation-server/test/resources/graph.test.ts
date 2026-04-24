import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import { buildGraphScenario } from '../support/resource-scenarios.js';
import { expectResourceToMatchSchema } from '../support/resource-schema.js';

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

  test('returns a local canonical graph slice around the focused node', async () => {
    const app = await createTestApp();

    try {
      const scenario = await buildGraphScenario(app);
      const graph = await app.mcpServer.readResource(
        `investigation://cases/${scenario.caseId}/graph?focusId=${scenario.focusHypothesisId}`
      );
      expectResourceToMatchSchema('resources/v1/case.graph.schema.json', graph.data);

      expect(graph.data).toMatchObject({
        data: {
          focusId: scenario.focusHypothesisId,
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: scenario.focusHypothesisId, kind: 'hypothesis' }),
            expect.objectContaining({ id: scenario.problemId, kind: 'problem', displayKind: 'problem' }),
            expect.objectContaining({ id: scenario.focusRepairAttemptId, kind: 'repair_attempt', displayKind: 'repair_attempt' })
          ]),
          edges: expect.arrayContaining([
            expect.objectContaining({ type: 'structural', fromId: scenario.problemId, toId: scenario.focusHypothesisId }),
            expect.objectContaining({ type: 'structural', fromId: scenario.focusHypothesisId, toId: scenario.focusRepairAttemptId })
          ])
        }
      });

      const nodeIds = new Set(((graph.data as { data: { nodes: Array<{ id: string }> } }).data.nodes).map((node) => node.id));
      expect(nodeIds.has(scenario.unrelatedHypothesisId)).toBe(false);
    } finally {
      await app.close();
    }
  });

  test('returns canonical graph nodes for cases that use the canonical command set', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'graph-canonical-open-001',
        title: 'Canonical graph slice',
        objective: 'Project canonical graph nodes and edges',
        severity: 'high',
        projectDirectory: '/workspace/graph-canonical-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const hypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'graph-canonical-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'canonical branch root hypothesis',
        falsificationCriteria: ['canonical falsification']
      });
      const hypothesisId = hypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
        idempotencyKey: 'graph-canonical-hypothesis-status-001',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        newStatus: 'confirmed',
        reason: 'reviewed and accepted'
      });

      const repairAttempt = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
        idempotencyKey: 'graph-canonical-repair-001',
        caseId,
        ifCaseRevision: 3,
        parentNodeId: hypothesisId,
        changeSummary: 'deploy canonical patch'
      });
      const repairAttemptId = repairAttempt.createdIds?.find((value) => value.startsWith('repair_attempt_'))!;

      const evidence = await app.mcpServer.invokeTool('investigation.evidence.capture_and_attach', {
        idempotencyKey: 'graph-canonical-evidence-001',
        caseId,
        ifCaseRevision: 4,
        parentNodeId: repairAttemptId,
        kind: 'experiment_result',
        title: 'Canonical validation result',
        summary: 'Latency dropped after patch deployment.',
        provenance: 'validation-job-graph-001',
        effectOnParent: 'validates',
        interpretation: 'The repair attempt improved the target metric.'
      });
      const evidenceRefId = evidence.createdIds?.find((value) => value.startsWith('evidence_ref_'))!;

      const graph = await app.mcpServer.readResource(`investigation://cases/${caseId}/graph?focusId=${hypothesisId}&depth=2`);
      expectResourceToMatchSchema('resources/v1/case.graph.schema.json', graph.data);

      expect(graph.data).toMatchObject({
        data: {
          focusId: hypothesisId,
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: problemId, kind: 'problem', displayKind: 'problem' }),
            expect.objectContaining({ id: hypothesisId, kind: 'hypothesis', displayKind: 'hypothesis' }),
            expect.objectContaining({ id: repairAttemptId, kind: 'repair_attempt', displayKind: 'repair_attempt' }),
            expect.objectContaining({ id: evidenceRefId, kind: 'evidence_ref', displayKind: 'evidence_ref' })
          ]),
          edges: expect.arrayContaining([
            expect.objectContaining({ type: 'structural', fromId: problemId, toId: hypothesisId }),
            expect.objectContaining({ type: 'structural', fromId: hypothesisId, toId: repairAttemptId }),
            expect.objectContaining({ type: 'structural', fromId: repairAttemptId, toId: evidenceRefId })
          ])
        }
      });
    } finally {
      await app.close();
    }
  });
});
