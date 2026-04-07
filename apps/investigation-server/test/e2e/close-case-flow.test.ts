import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
import {
  advanceStage,
  assertFact,
  attachArtifact,
  closeInquiry,
  completeExperiment,
  openCase,
  planExperiment,
  proposeHypothesis,
  reportSymptom,
  updateHypothesis
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
        blockingInquiryIds: expect.arrayContaining([opened.inquiryId]),
        reasons: expect.arrayContaining([
          expect.stringMatching(/repair_validation/i),
          expect.stringMatching(/inquiries/i)
        ])
      });

      let revision = await advanceStage(app, opened.caseId, opened.revision, 'scoping', 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'evidence_collection', 'close-flow');
      const symptom = await reportSymptom(app, opened.caseId, revision, 'close-flow');
      revision = symptom.revision;
      const artifact = await attachArtifact(app, opened.caseId, revision, 'close-flow');
      revision = artifact.revision;
      const fact = await assertFact(app, opened.caseId, revision, artifact.artifactId, [symptom.symptomId], 'close-flow');
      revision = fact.revision;
      const hypothesis = await proposeHypothesis(
        app,
        opened.caseId,
        opened.inquiryId,
        revision,
        symptom.symptomId,
        fact.factId,
        'close-flow'
      );
      revision = await advanceStage(app, opened.caseId, hypothesis.revision, 'hypothesis_competition', 'close-flow');
      revision = await updateHypothesis(app, opened.caseId, revision, hypothesis.hypothesisId, 'active', 'close-flow');
      revision = await updateHypothesis(app, opened.caseId, revision, hypothesis.hypothesisId, 'favored', 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'discriminative_testing', 'close-flow');
      const experiment = await planExperiment(app, opened.caseId, opened.inquiryId, revision, hypothesis.hypothesisId, 'close-flow');
      revision = await completeExperiment(app, opened.caseId, experiment.revision, experiment.experimentId, 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'repair_preparation', 'close-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'repair_validation', 'close-flow');
      revision = await closeInquiry(app, opened.caseId, revision, opened.inquiryId, 'close-flow');

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