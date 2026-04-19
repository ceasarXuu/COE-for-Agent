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
  resolveProblem,
  setHypothesisStatus,
  setRepairAttemptStatus,
  updateProblem
} from './helpers.js';

describe.sequential('close case flow', () => {
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

  test('moves from a blocked close_case_check to a clean closure once repair validation evidence exists', async () => {
    const app = await createTestApp();

    try {
      const opened = await openCase(app, 'close-flow');

      const initiallyBlocked = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId: opened.caseId
      });

      expect(initiallyBlocked).toMatchObject({
        pass: false,
        reasons: expect.arrayContaining([
          expect.stringMatching(/repair_validation/i),
          expect.stringMatching(/problem/i)
        ])
      });

      let revision = await advanceStage(app, opened.caseId, opened.revision, 'scoping', 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'evidence_collection', 'close-flow');
      revision = await updateProblem(app, opened.caseId, revision, opened.problemId, 'close-flow');
      const hypothesis = await createHypothesis(app, opened.caseId, revision, opened.problemId, 'close-flow');
      revision = await advanceStage(app, opened.caseId, hypothesis.revision, 'hypothesis_competition', 'close-flow');
      revision = await setHypothesisStatus(app, opened.caseId, revision, hypothesis.hypothesisId, 'confirmed', 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'discriminative_testing', 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'repair_preparation', 'close-flow');
      const repairAttempt = await createRepairAttempt(app, opened.caseId, revision, hypothesis.hypothesisId, 'close-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, repairAttempt.revision, repairAttempt.repairAttemptId, 'running', 'close-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'effective', 'close-flow');
      const evidence = await attachValidationEvidence(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'close-flow');
      revision = evidence.revision;
      revision = await advanceStage(app, opened.caseId, revision, 'repair_validation', 'close-flow');

      const stillBlocked = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId: opened.caseId
      });

      expect(stillBlocked).toMatchObject({
        pass: false,
        blockingInquiryIds: [],
        reasons: expect.arrayContaining([expect.stringMatching(/problem/i)])
      });

      revision = await resolveProblem(app, opened.caseId, revision, opened.problemId, 'close-flow');

      const readyToClose = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId: opened.caseId
      });

      expect(readyToClose).toMatchObject({
        pass: true,
        blockingInquiryIds: [],
        blockingResidualIds: [],
        missingValidationRefs: []
      });

      revision = await advanceStage(app, opened.caseId, revision, 'closed', 'close-flow');

      const snapshot = await app.mcpServer.readResource(`investigation://cases/${opened.caseId}/snapshot`);
      expect(snapshot.data).toMatchObject({
        headRevision: revision,
        data: {
          case: expect.objectContaining({
            id: opened.caseId,
            stage: 'closed',
            status: 'closed'
          })
        }
      });
    } finally {
      await app.close();
    }
  });
});
