import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { CurrentStateRepository } from '@coe/persistence';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('canonical graph commands', () => {
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

  test('creates hypotheses under the canonical problem root and blocks invalid status transitions', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-hypothesis-open-001',
        title: 'Canonical hypothesis flow',
        objective: 'Exercise canonical hypothesis commands',
        severity: 'high',
        projectDirectory: '/workspace/canonical-hypothesis-open-001'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const created = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-hypothesis-create-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'database connection exhaustion causes the latency spikes',
        falsificationCriteria: ['connection pool stays below 60% under peak load']
      });
      const hypothesisId = created.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const currentState = new CurrentStateRepository(app.services.db);
      const hypothesisRecord = await currentState.getRecord('hypotheses', hypothesisId);
      expect(hypothesisRecord?.status).toBe('unverified');

      await expect(
        app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
          idempotencyKey: 'canonical-hypothesis-status-001',
          caseId,
          ifCaseRevision: 2,
          hypothesisId,
          newStatus: 'confirmed',
          reason: 'reviewed and accepted'
        })
      ).resolves.toMatchObject({
        updatedIds: [hypothesisId]
      });

      await expect(
        app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
          idempotencyKey: 'canonical-hypothesis-status-002',
          caseId,
          ifCaseRevision: 3,
          hypothesisId,
          newStatus: 'unverified',
          reason: 'should not move back from confirmed'
        })
      ).rejects.toThrow(/Invalid canonical hypothesis transition/);
    } finally {
      await app.close();
    }
  });

  test('opens and closes blockers only under hypotheses', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-blocker-open-001',
        title: 'Canonical blocker flow',
        objective: 'Exercise canonical blocker commands',
        severity: 'medium',
        projectDirectory: '/workspace/canonical-blocker-open-001'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;
      const createdHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-blocker-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'upstream queue saturation is the branch root',
        falsificationCriteria: ['queue drain remains healthy under replay']
      });
      const hypothesisId = createdHypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const blocker = await app.mcpServer.invokeTool('investigation.blocker.open', {
        idempotencyKey: 'canonical-blocker-create-001',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        description: 'No shell access to the staging cluster'
      });
      const blockerId = blocker.createdIds?.find((value) => value.startsWith('blocker_'))!;

      const closed = await app.mcpServer.invokeTool('investigation.blocker.close', {
        idempotencyKey: 'canonical-blocker-close-001',
        caseId,
        ifCaseRevision: 3,
        blockerId,
        reason: 'Temporary access was granted'
      });

      expect(closed.updatedIds).toContain(blockerId);
    } finally {
      await app.close();
    }
  });

  test('gates repair attempts behind canonical parent status rules', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-repair-open-001',
        title: 'Canonical repair flow',
        objective: 'Exercise canonical repair attempt commands',
        severity: 'critical',
        projectDirectory: '/workspace/canonical-repair-open-001'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;
      const createdHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-repair-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'connection reuse bug leaks sockets',
        falsificationCriteria: ['socket count remains flat after reuse patch']
      });
      const hypothesisId = createdHypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      await expect(
        app.mcpServer.invokeTool('investigation.repair_attempt.create', {
          idempotencyKey: 'canonical-repair-create-001',
          caseId,
          ifCaseRevision: 2,
          parentNodeId: hypothesisId,
          changeSummary: 'try a socket cleanup patch'
        })
      ).rejects.toThrow(/Invalid canonical child creation/);

      await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
        idempotencyKey: 'canonical-repair-status-001',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        newStatus: 'confirmed',
        reason: 'reviewer confirmed the branch'
      });

      const repairAttempt = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
        idempotencyKey: 'canonical-repair-create-002',
        caseId,
        ifCaseRevision: 3,
        parentNodeId: hypothesisId,
        changeSummary: 'apply socket cleanup patch',
        confidence: 0.72
      });
      const repairAttemptId = repairAttempt.createdIds?.find((value) => value.startsWith('repair_attempt_'))!;

      await app.mcpServer.invokeTool('investigation.repair_attempt.set_status', {
        idempotencyKey: 'canonical-repair-status-002',
        caseId,
        ifCaseRevision: 4,
        repairAttemptId,
        newStatus: 'running',
        reason: 'patch deployment started'
      });

      await app.mcpServer.invokeTool('investigation.repair_attempt.set_status', {
        idempotencyKey: 'canonical-repair-status-003',
        caseId,
        ifCaseRevision: 5,
        repairAttemptId,
        newStatus: 'ineffective',
        reason: 'error rate remained unchanged'
      });

      const followUp = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
        idempotencyKey: 'canonical-repair-create-003',
        caseId,
        ifCaseRevision: 6,
        parentNodeId: repairAttemptId,
        changeSummary: 'try connection timeout rollback'
      });

      expect(followUp.createdIds?.some((value) => value.startsWith('repair_attempt_'))).toBe(true);
    } finally {
      await app.close();
    }
  });
});
