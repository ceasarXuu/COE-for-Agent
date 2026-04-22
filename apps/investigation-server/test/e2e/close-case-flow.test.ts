import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import {
  attachValidationEvidence,
  closeCase,
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
          expect.stringMatching(/problem/i)
        ])
      });

      let revision = opened.revision;
      revision = await updateProblem(app, opened.caseId, revision, opened.problemId, 'close-flow');
      const hypothesis = await createHypothesis(app, opened.caseId, revision, opened.problemId, 'close-flow');
      revision = hypothesis.revision;
      revision = await setHypothesisStatus(app, opened.caseId, revision, hypothesis.hypothesisId, 'confirmed', 'close-flow');
      const repairAttempt = await createRepairAttempt(app, opened.caseId, revision, hypothesis.hypothesisId, 'close-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, repairAttempt.revision, repairAttempt.repairAttemptId, 'running', 'close-flow');
      revision = await setRepairAttemptStatus(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'effective', 'close-flow');
      const evidence = await attachValidationEvidence(app, opened.caseId, revision, repairAttempt.repairAttemptId, 'close-flow');
      revision = evidence.revision;

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

      revision = await closeCase(app, opened.caseId, revision, 'close-flow');

      const snapshot = await app.mcpServer.readResource(`investigation://cases/${opened.caseId}/snapshot`);
      expect(snapshot.data).toMatchObject({
        headRevision: revision,
        data: {
          case: expect.objectContaining({
            id: opened.caseId,
            status: 'closed'
          })
        }
      });
    } finally {
      await app.close();
    }
  });
});
