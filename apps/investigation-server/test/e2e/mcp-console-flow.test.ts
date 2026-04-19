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
  completeExperiment,
  openCase,
  planExperiment,
  proposeHypothesis,
  recordDecision,
  registerEntity,
  reportSymptom,
  updateHypothesis
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

  test('builds a full evidence chain and exposes the same case through list, snapshot, graph, timeline, and guardrails', async () => {
    const app = await createTestApp();

    try {
      const opened = await openCase(app, 'full-flow');
      let revision = await advanceStage(app, opened.caseId, opened.revision, 'scoping', 'full-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'evidence_collection', 'full-flow');

      const symptom = await reportSymptom(app, opened.caseId, revision, 'full-flow');
      revision = symptom.revision;
      const entity = await registerEntity(app, opened.caseId, revision, 'full-flow');
      revision = entity.revision;
      const artifact = await attachArtifact(app, opened.caseId, revision, 'full-flow');
      revision = artifact.revision;
      const fact = await assertFact(app, opened.caseId, revision, artifact.artifactId, [symptom.symptomId, entity.entityId], 'full-flow');
      revision = fact.revision;

      const hypothesis = await proposeHypothesis(
        app,
        opened.caseId,
        opened.inquiryId,
        revision,
        symptom.symptomId,
        fact.factId,
        'full-flow'
      );
      revision = await advanceStage(app, opened.caseId, hypothesis.revision, 'hypothesis_competition', 'full-flow');
      revision = await updateHypothesis(app, opened.caseId, revision, hypothesis.hypothesisId, 'active', 'full-flow');
      revision = await updateHypothesis(app, opened.caseId, revision, hypothesis.hypothesisId, 'favored', 'full-flow');
      revision = await advanceStage(app, opened.caseId, revision, 'discriminative_testing', 'full-flow');

      const experiment = await planExperiment(app, opened.caseId, opened.inquiryId, revision, hypothesis.hypothesisId, 'full-flow');
      revision = await completeExperiment(app, opened.caseId, experiment.revision, experiment.experimentId, 'full-flow');

      const readyToPatch = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId: opened.caseId
      });

      expect(readyToPatch).toMatchObject({
        pass: true,
        candidateHypothesisIds: expect.arrayContaining([hypothesis.hypothesisId]),
        candidatePatchRefs: expect.arrayContaining([entity.entityId]),
        blockingGapIds: [],
        blockingResidualIds: []
      });

      const decision = await recordDecision(
        app,
        opened.caseId,
        revision,
        opened.inquiryId,
        fact.factId,
        experiment.experimentId,
        hypothesis.hypothesisId,
        'full-flow'
      );
      revision = await advanceStage(app, opened.caseId, decision.revision, 'repair_preparation', 'full-flow');

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
              stage: 'repair_preparation',
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
            stage: 'repair_preparation',
            status: 'ready_to_patch'
          }),
          counts: expect.objectContaining({
            inquiries: 1,
            symptoms: 1,
            artifacts: 1,
            facts: 1
          })
        }
      });
      expect(timeline.data).toMatchObject({
        data: {
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: 'decision.recorded' }),
            expect.objectContaining({ eventType: 'case.stage_advanced', caseRevision: revision })
          ])
        }
      });
      expect(graph.data).toMatchObject({
        data: {
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: hypothesis.hypothesisId, kind: 'hypothesis' }),
            expect.objectContaining({ id: experiment.experimentId, kind: 'experiment' }),
            expect.objectContaining({ id: decision.decisionId, kind: 'decision' })
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
