import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import {
  attachValidationEvidence,
  createHypothesis,
  createRepairAttempt,
  openCase,
  setHypothesisStatus,
  setRepairAttemptStatus,
  updateProblem
} from './helpers.js';

describe.sequential('mcp console flow', () => {
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

  test('builds a canonical investigation chain and exposes the same case through list, snapshot, graph, timeline, and guardrails', async () => {
    const app = await createTestApp();

    try {
      const opened = await openCase(app, 'full-flow');
      let revision = opened.revision;
      revision = await updateProblem(app, opened.caseId, revision, opened.problemId, 'full-flow');
      const hypothesis = await createHypothesis(app, opened.caseId, revision, opened.problemId, 'full-flow');
      revision = hypothesis.revision;
      revision = await setHypothesisStatus(app, opened.caseId, revision, hypothesis.hypothesisId, 'confirmed', 'full-flow');

      const readyToPatch = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId: opened.caseId
      });

      expect(readyToPatch).toMatchObject({
        pass: true,
        candidateHypothesisIds: expect.arrayContaining([hypothesis.hypothesisId]),
        blockingIssueIds: []
      });

      const repairAttempt = await createRepairAttempt(app, opened.caseId, revision, hypothesis.hypothesisId, 'full-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, repairAttempt.revision, repairAttempt.repairAttemptId, 'running', 'full-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'effective', 'full-flow');
      const evidence = await attachValidationEvidence(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'full-flow');
      revision = evidence.revision;

      const [cases, snapshot, timeline, graph, aggregate] = await Promise.all([
        app.mcpServer.readResource('investigation://cases'),
        app.mcpServer.readResource(`investigation://cases/${opened.caseId}/snapshot`),
        app.mcpServer.readResource(`investigation://cases/${opened.caseId}/timeline`),
        app.mcpServer.readResource(`investigation://cases/${opened.caseId}/graph`),
        app.mcpServer.invokeTool('investigation.guardrail.check', { caseId: opened.caseId })
      ]);

      expect(cases.data).toMatchObject({
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              caseId: opened.caseId,
              headRevision: revision
            })
          ])
        }
      });
      expect(snapshot.data).toMatchObject({
        headRevision: revision,
        data: {
          case: expect.objectContaining({
            id: opened.caseId,
            status: 'active'
          }),
          counts: {
            problems: 1,
            hypotheses: 1,
            blockers: 0,
            repairAttempts: 1,
            evidenceRefs: 1
          }
        }
      });
      expect(timeline.data).toMatchObject({
        data: {
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: 'canonical.repair_attempt.status_updated' }),
            expect.objectContaining({ eventType: 'canonical.evidence.attached' })
          ])
        }
      });
      expect(graph.data).toMatchObject({
        data: {
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: opened.problemId, kind: 'problem' }),
            expect.objectContaining({ id: hypothesis.hypothesisId, kind: 'hypothesis' }),
            expect.objectContaining({ id: repairAttempt.repairAttemptId, kind: 'repair_attempt' }),
            expect.objectContaining({ id: evidence.evidenceRefId, kind: 'evidence_ref' })
          ])
        }
      });
      expect(aggregate).toMatchObject({
        warnings: [],
        violations: []
      });
    } finally {
      await app.close();
    }
  });
});
