import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('ready_to_patch guardrail', () => {
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

  test('fails when an open critical residual is blocking the candidate hypothesis', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'ready-open-001',
        title: 'Patch blocked by residual',
        objective: 'Verify ready_to_patch blockers',
        severity: 'critical',
        projectDirectory: '/workspace/ready-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;
      let revision = 1;

      const symptom = await app.mcpServer.invokeTool('investigation.symptom.report', {
        idempotencyKey: 'ready-symptom-001',
        caseId,
        ifCaseRevision: revision,
        statement: 'duplicate payment captures occur',
        severity: 'critical',
        reproducibility: 'always'
      });
      revision = symptom.headRevisionAfter;
      const symptomId = symptom.createdIds?.find((value) => value.startsWith('symptom_'))!;

      const hypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.propose', {
        idempotencyKey: 'ready-hypothesis-001',
        caseId,
        ifCaseRevision: revision,
        inquiryId,
        title: 'idempotency gate misses a partition',
        statement: 'a partition-specific path bypasses the idempotency gate',
        level: 'root_cause',
        explainsSymptomIds: [symptomId],
        falsificationCriteria: ['partitioned traffic still respects the gate']
      });
      revision = hypothesis.headRevisionAfter;
      const hypothesisId = hypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const activated = await app.mcpServer.invokeTool('investigation.hypothesis.update_status', {
        idempotencyKey: 'ready-hypothesis-status-001',
        caseId,
        ifCaseRevision: revision,
        hypothesisId,
        newStatus: 'active'
      });
      revision = activated.headRevisionAfter;

      const updated = await app.mcpServer.invokeTool('investigation.hypothesis.update_status', {
        idempotencyKey: 'ready-hypothesis-status-002',
        caseId,
        ifCaseRevision: revision,
        hypothesisId,
        newStatus: 'favored'
      });
      revision = updated.headRevisionAfter;

      const experiment = await app.mcpServer.invokeTool('investigation.experiment.plan', {
        idempotencyKey: 'ready-experiment-001',
        caseId,
        ifCaseRevision: revision,
        inquiryId,
        title: 'trace partition gate',
        objective: 'observe whether the partitioned path skips the gate',
        method: 'instrumentation',
        testsHypothesisIds: [hypothesisId],
        expectedOutcomes: [{ when: 'gate is bypassed', expect: 'partition path emits duplicate capture' }]
      });
      revision = experiment.headRevisionAfter;
      const experimentId = experiment.createdIds?.find((value) => value.startsWith('experiment_'))!;

      const completed = await app.mcpServer.invokeTool('investigation.experiment.record_result', {
        idempotencyKey: 'ready-experiment-result-001',
        caseId,
        ifCaseRevision: revision,
        experimentId,
        status: 'completed',
        summary: 'the partitioned path emitted two captures in one request'
      });
      revision = completed.headRevisionAfter;

      const residual = await app.mcpServer.invokeTool('investigation.residual.open', {
        idempotencyKey: 'ready-residual-001',
        caseId,
        ifCaseRevision: revision,
        statement: 'duplicate captures still happen during regional failover',
        severity: 'critical',
        relatedSymptomIds: [symptomId]
      });
      const residualId = residual.createdIds?.find((value) => value.startsWith('residual_'))!;

      const result = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId
      });

      expect(result).toMatchObject({
        pass: false,
        candidateHypothesisIds: expect.arrayContaining([hypothesisId]),
        blockingResidualIds: expect.arrayContaining([residualId])
      });
    } finally {
      await app.close();
    }
  });

  test('clears blockingGapIds after a critical gap is resolved', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'ready-open-002',
        title: 'Patch blocked by gap',
        objective: 'Verify gap blockers are surfaced and cleared',
        severity: 'high',
        projectDirectory: '/workspace/ready-open-002'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;
      let revision = 1;

      const symptom = await app.mcpServer.invokeTool('investigation.symptom.report', {
        idempotencyKey: 'ready-symptom-002',
        caseId,
        ifCaseRevision: revision,
        statement: 'retry loop continues after success',
        severity: 'critical',
        reproducibility: 'always'
      });
      revision = symptom.headRevisionAfter;
      const symptomId = symptom.createdIds?.find((value) => value.startsWith('symptom_'))!;

      const hypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.propose', {
        idempotencyKey: 'ready-hypothesis-002',
        caseId,
        ifCaseRevision: revision,
        inquiryId,
        title: 'success marker commit is missing',
        statement: 'the success marker commit never persists',
        level: 'mechanism',
        explainsSymptomIds: [symptomId],
        falsificationCriteria: ['success marker exists before retry scheduling']
      });
      revision = hypothesis.headRevisionAfter;
      const hypothesisId = hypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const activated = await app.mcpServer.invokeTool('investigation.hypothesis.update_status', {
        idempotencyKey: 'ready-hypothesis-status-003',
        caseId,
        ifCaseRevision: revision,
        hypothesisId,
        newStatus: 'active'
      });
      revision = activated.headRevisionAfter;

      const updated = await app.mcpServer.invokeTool('investigation.hypothesis.update_status', {
        idempotencyKey: 'ready-hypothesis-status-004',
        caseId,
        ifCaseRevision: revision,
        hypothesisId,
        newStatus: 'favored'
      });
      revision = updated.headRevisionAfter;

      const experiment = await app.mcpServer.invokeTool('investigation.experiment.plan', {
        idempotencyKey: 'ready-experiment-002',
        caseId,
        ifCaseRevision: revision,
        inquiryId,
        title: 'probe success marker commit',
        objective: 'verify whether the marker commit is skipped',
        method: 'test_run',
        testsHypothesisIds: [hypothesisId],
        expectedOutcomes: [{ when: 'marker commit is skipped', expect: 'retry loop resumes immediately' }]
      });
      revision = experiment.headRevisionAfter;
      const experimentId = experiment.createdIds?.find((value) => value.startsWith('experiment_'))!;

      const completed = await app.mcpServer.invokeTool('investigation.experiment.record_result', {
        idempotencyKey: 'ready-experiment-result-002',
        caseId,
        ifCaseRevision: revision,
        experimentId,
        status: 'completed',
        summary: 'test run confirmed the marker commit was skipped'
      });
      revision = completed.headRevisionAfter;

      const gap = await app.mcpServer.invokeTool('investigation.gap.open', {
        idempotencyKey: 'ready-gap-001',
        caseId,
        ifCaseRevision: revision,
        question: 'which transaction path drops the success marker commit?',
        priority: 'critical',
        blockedRefs: [hypothesisId]
      });
      revision = gap.headRevisionAfter;
      const gapId = gap.createdIds?.find((value) => value.startsWith('gap_'))!;

      const blocked = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId
      });

      expect(blocked).toMatchObject({
        pass: false,
        blockingGapIds: expect.arrayContaining([gapId])
      });

      const resolved = await app.mcpServer.invokeTool('investigation.gap.resolve', {
        idempotencyKey: 'ready-gap-resolve-001',
        caseId,
        ifCaseRevision: revision,
        gapId,
        status: 'resolved',
        reason: 'commit path identified'
      });

      const unblocked = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId
      });

      expect(resolved.headRevisionAfter).toBeGreaterThan(revision);
      expect(unblocked).toMatchObject({
        pass: false,
        blockingGapIds: []
      });
    } finally {
      await app.close();
    }
  });
});
