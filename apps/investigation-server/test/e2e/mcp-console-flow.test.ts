import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import {
  advanceStage,
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
      let revision = await advanceStage(app, opened.caseId, opened.revision, 'scoping', 'full-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'evidence_collection', 'full-flow');
      revision = await updateProblem(app, opened.caseId, revision, opened.problemId, 'full-flow');
      const hypothesis = await createHypothesis(app, opened.caseId, revision, opened.problemId, 'full-flow');
      revision = await advanceStage(app, opened.caseId, hypothesis.revision, 'hypothesis_competition', 'full-flow');
      revision = await setHypothesisStatus(app, opened.caseId, revision, hypothesis.hypothesisId, 'confirmed', 'full-flow');

      const readyToPatch = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId: opened.caseId
      });

      expect(readyToPatch).toMatchObject({
        pass: true,
        candidateHypothesisIds: expect.arrayContaining([hypothesis.hypothesisId]),
        blockingIssueIds: []
      });

      revision = await advanceStage(app, opened.caseId, revision, 'discriminative_testing', 'full-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'repair_preparation', 'full-flow');
      const repairAttempt = await createRepairAttempt(app, opened.caseId, revision, hypothesis.hypothesisId, 'full-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, repairAttempt.revision, repairAttempt.repairAttemptId, 'running', 'full-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'effective', 'full-flow');
      const evidence = await attachValidationEvidence(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'full-flow');
      revision = evidence.revision;
      revision = await advanceStage(app, opened.caseId, revision, 'repair_validation', 'full-flow');

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
              stage: 'repair_validation',
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
            stage: 'repair_validation',
            status: 'validating'
          }),
          counts: expect.objectContaining({
            inquiries: 0,
            symptoms: 0,
            artifacts: 0,
            facts: 0
          })
        }
      });
      expect(timeline.data).toMatchObject({
        data: {
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: 'canonical.repair_attempt.status_updated' }),
            expect.objectContaining({ eventType: 'canonical.evidence.attached' }),
            expect.objectContaining({ eventType: 'case.stage_advanced', caseRevision: revision })
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
