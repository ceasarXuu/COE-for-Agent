import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('canonical guardrails', () => {
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

  test('aggregate guardrail reports active canonical blockers', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-check-open-001',
        title: 'Canonical aggregate blocker',
        objective: 'Surface canonical blockers in aggregate guardrails',
        severity: 'high',
        projectDirectory: '/workspace/canonical-check-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const createdHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-check-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'cache invalidation queue is stuck',
        falsificationCriteria: ['invalidation queue drains under replay']
      });
      const hypothesisId = createdHypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const openedBlocker = await app.mcpServer.invokeTool('investigation.blocker.open', {
        idempotencyKey: 'canonical-check-blocker-open-001',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        description: 'cannot inspect the production queue metrics'
      });
      const blockerId = openedBlocker.createdIds?.find((value) => value.startsWith('blocker_'))!;

      const result = await app.mcpServer.invokeTool('investigation.guardrail.check', {
        caseId
      });

      expect(result).toMatchObject({
        warnings: expect.arrayContaining([
          expect.objectContaining({
            code: 'stale_blockers',
            nodeIds: expect.arrayContaining([blockerId])
          })
        ])
      });
    } finally {
      await app.close();
    }
  });

  test('ready_to_patch uses canonical blockers instead of legacy gap or residual blockers', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-ready-open-001',
        title: 'Canonical ready blocker',
        objective: 'Use canonical graph state for ready_to_patch',
        severity: 'critical',
        projectDirectory: '/workspace/canonical-ready-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const createdHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-ready-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'connection pool deadlocks under retry fanout',
        falsificationCriteria: ['pool metrics stay healthy during retry fanout']
      });
      const hypothesisId = createdHypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const confirmed = await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
        idempotencyKey: 'canonical-ready-hypothesis-status-001',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        newStatus: 'confirmed',
        reason: 'reviewer accepted the root-cause branch'
      });

      const openedBlocker = await app.mcpServer.invokeTool('investigation.blocker.open', {
        idempotencyKey: 'canonical-ready-blocker-open-001',
        caseId,
        ifCaseRevision: confirmed.headRevisionAfter,
        hypothesisId,
        description: 'cannot run the load probe in production yet',
        possibleWorkarounds: ['request temporary access']
      });
      const blockerId = openedBlocker.createdIds?.find((value) => value.startsWith('blocker_'))!;

      const blocked = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId
      });

      expect(blocked).toMatchObject({
        pass: false,
        candidateHypothesisIds: expect.arrayContaining([hypothesisId]),
        blockingIssueIds: expect.arrayContaining([blockerId]),
        reasons: expect.arrayContaining([expect.stringMatching(/blocker/i)])
      });

      const closedBlocker = await app.mcpServer.invokeTool('investigation.blocker.close', {
        idempotencyKey: 'canonical-ready-blocker-close-001',
        caseId,
        ifCaseRevision: openedBlocker.headRevisionAfter,
        blockerId,
        reason: 'temporary access granted'
      });

      const unblocked = await app.mcpServer.invokeTool('investigation.guardrail.ready_to_patch_check', {
        caseId
      });

      expect(closedBlocker.headRevisionAfter).toBeGreaterThan(openedBlocker.headRevisionAfter);
      expect(unblocked).toMatchObject({
        pass: true,
        candidateHypothesisIds: expect.arrayContaining([hypothesisId]),
        blockingIssueIds: []
      });
    } finally {
      await app.close();
    }
  });

  test('close_case uses canonical problem and repair validation state instead of legacy inquiry closure', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-close-open-001',
        title: 'Canonical close-case flow',
        objective: 'Use canonical repair evidence for close_case',
        severity: 'high',
        projectDirectory: '/workspace/canonical-close-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      let revision = 1;
      for (const stage of [
        'scoping',
        'evidence_collection',
        'hypothesis_competition',
        'discriminative_testing',
        'repair_preparation',
        'repair_validation'
      ] as const) {
        const advanced = await app.mcpServer.invokeTool('investigation.case.advance_stage', {
          idempotencyKey: `canonical-close-stage-${stage}`,
          caseId,
          ifCaseRevision: revision,
          stage,
          reason: `advance to ${stage}`
        });
        revision = advanced.headRevisionAfter;
      }

      const createdHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-close-hypothesis-001',
        caseId,
        ifCaseRevision: revision,
        parentNodeId: problemId,
        statement: 'retry worker leaks the completion lock',
        falsificationCriteria: ['completion lock remains stable under replay']
      });
      const hypothesisId = createdHypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;
      revision = createdHypothesis.headRevisionAfter;

      const confirmed = await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
        idempotencyKey: 'canonical-close-hypothesis-status-001',
        caseId,
        ifCaseRevision: revision,
        hypothesisId,
        newStatus: 'confirmed',
        reason: 'reviewer confirmed the branch'
      });
      revision = confirmed.headRevisionAfter;

      const createdRepairAttempt = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
        idempotencyKey: 'canonical-close-repair-001',
        caseId,
        ifCaseRevision: revision,
        parentNodeId: hypothesisId,
        changeSummary: 'serialize completion lock release'
      });
      const repairAttemptId = createdRepairAttempt.createdIds?.find((value) => value.startsWith('repair_attempt_'))!;
      revision = createdRepairAttempt.headRevisionAfter;

      const running = await app.mcpServer.invokeTool('investigation.repair_attempt.set_status', {
        idempotencyKey: 'canonical-close-repair-status-001',
        caseId,
        ifCaseRevision: revision,
        repairAttemptId,
        newStatus: 'running',
        reason: 'patch deployed to validation environment'
      });
      revision = running.headRevisionAfter;

      const effective = await app.mcpServer.invokeTool('investigation.repair_attempt.set_status', {
        idempotencyKey: 'canonical-close-repair-status-002',
        caseId,
        ifCaseRevision: revision,
        repairAttemptId,
        newStatus: 'effective',
        reason: 'validation run passed'
      });
      revision = effective.headRevisionAfter;

      const attachedEvidence = await app.mcpServer.invokeTool('investigation.evidence.capture_and_attach', {
        idempotencyKey: 'canonical-close-evidence-001',
        caseId,
        ifCaseRevision: revision,
        parentNodeId: repairAttemptId,
        kind: 'experiment_result',
        title: 'validation replay result',
        summary: 'the retry worker no longer duplicates the completion path',
        provenance: 'validation-replay-job',
        effectOnParent: 'validates',
        interpretation: 'repair validation succeeded'
      });
      revision = attachedEvidence.headRevisionAfter;

      const stillBlocked = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId
      });

      expect(stillBlocked).toMatchObject({
        pass: false,
        blockingInquiryIds: [],
        reasons: expect.arrayContaining([expect.stringMatching(/problem/i)])
      });

      const resolvedProblem = await app.mcpServer.invokeTool('investigation.problem.set_status', {
        idempotencyKey: 'canonical-close-problem-status-001',
        caseId,
        ifCaseRevision: revision,
        problemId,
        newStatus: 'resolved',
        reason: 'validation confirms the issue is fixed'
      });

      const closable = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId
      });

      expect(resolvedProblem.headRevisionAfter).toBeGreaterThan(revision);
      expect(closable).toMatchObject({
        pass: true,
        blockingInquiryIds: [],
        blockingResidualIds: [],
        missingValidationRefs: []
      });
    } finally {
      await app.close();
    }
  });

  test('stall_check counts canonical hypotheses when they pile up without narrowing', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-stall-open-001',
        title: 'Canonical hypothesis pileup',
        objective: 'Trigger canonical stall detection',
        severity: 'high',
        projectDirectory: '/workspace/canonical-stall-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      let revision = 1;
      for (const suffix of ['001', '002', '003', '004']) {
        const created = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
          idempotencyKey: `canonical-stall-hypothesis-${suffix}`,
          caseId,
          ifCaseRevision: revision,
          parentNodeId: problemId,
          statement: `candidate branch ${suffix}`,
          falsificationCriteria: [`rule out branch ${suffix}`]
        });
        revision = created.headRevisionAfter;
      }

      const result = await app.mcpServer.invokeTool('investigation.guardrail.stall_check', {
        caseId
      });

      expect(result).toMatchObject({
        risk: expect.stringMatching(/medium|high/),
        signals: expect.arrayContaining([
          expect.objectContaining({
            code: 'active_hypothesis_count_gt_3'
          })
        ])
      });
    } finally {
      await app.close();
    }
  });
});
