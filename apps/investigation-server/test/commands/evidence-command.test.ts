import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { CurrentStateRepository } from '@coe/persistence';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('canonical evidence commands', () => {
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

  test('captures reusable evidence in the shared pool', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-evidence-open-001',
        title: 'Canonical evidence pool',
        objective: 'Exercise evidence capture',
        severity: 'high',
        projectDirectory: '/workspace/canonical-evidence-open-001'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const captured = await app.mcpServer.invokeTool('investigation.evidence.capture', {
        idempotencyKey: 'canonical-evidence-capture-001',
        caseId,
        ifCaseRevision: 1,
        kind: 'log',
        title: 'Connection pool saturation log',
        summary: 'Pool saturation appears right before latency spikes.',
        provenance: 'worker.log@2026-04-18T12:30Z',
        confidence: 0.81
      });

      const evidenceId = captured.createdIds?.find((value) => value.startsWith('evidence_'))!;
      const currentState = new CurrentStateRepository(app.services.db);
      const evidenceRecord = await currentState.getRecord('evidence_pool', evidenceId);

      expect(evidenceRecord?.payload).toMatchObject({
        title: 'Connection pool saturation log',
        provenance: 'worker.log@2026-04-18T12:30Z'
      });
    } finally {
      await app.close();
    }
  });

  test('attaches captured evidence under a canonical hypothesis and enforces effect semantics', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-evidence-open-002',
        title: 'Canonical evidence attach',
        objective: 'Exercise evidence attachment',
        severity: 'critical',
        projectDirectory: '/workspace/canonical-evidence-open-002'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;
      const hypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-evidence-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'queue contention causes the regression',
        falsificationCriteria: ['queue contention never exceeds 10%']
      });
      const hypothesisId = hypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;
      const captured = await app.mcpServer.invokeTool('investigation.evidence.capture', {
        idempotencyKey: 'canonical-evidence-capture-002',
        caseId,
        ifCaseRevision: 2,
        kind: 'trace',
        title: 'Queue contention trace',
        contentRef: 'trace://queue-contention',
        provenance: 'perf-trace-001'
      });
      const evidenceId = captured.createdIds?.find((value) => value.startsWith('evidence_'))!;

      const attached = await app.mcpServer.invokeTool('investigation.evidence.attach_existing', {
        idempotencyKey: 'canonical-evidence-attach-001',
        caseId,
        ifCaseRevision: 3,
        parentNodeId: hypothesisId,
        evidenceId,
        effectOnParent: 'supports',
        interpretation: 'The contention trace matches the suspected branch.'
      });

      expect(attached.createdIds?.some((value) => value.startsWith('evidence_ref_'))).toBe(true);

      await expect(
        app.mcpServer.invokeTool('investigation.evidence.attach_existing', {
          idempotencyKey: 'canonical-evidence-attach-002',
          caseId,
          ifCaseRevision: 4,
          parentNodeId: hypothesisId,
          evidenceId,
          effectOnParent: 'validates',
          interpretation: 'This should be rejected for a hypothesis parent.'
        })
      ).rejects.toThrow(/Invalid evidence effect/);
    } finally {
      await app.close();
    }
  });

  test('captures and attaches evidence atomically under repair attempts', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'canonical-evidence-open-003',
        title: 'Canonical evidence capture-and-attach',
        objective: 'Exercise capture-and-attach on repair attempts',
        severity: 'medium',
        projectDirectory: '/workspace/canonical-evidence-open-003'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;
      const hypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'canonical-evidence-hypothesis-002',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'socket cleanup patch will fix the leak',
        falsificationCriteria: ['socket count still grows after cleanup']
      });
      const hypothesisId = hypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;
      await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
        idempotencyKey: 'canonical-evidence-hypothesis-status-001',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        newStatus: 'confirmed',
        reason: 'reviewed and accepted'
      });
      const repairAttempt = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
        idempotencyKey: 'canonical-evidence-repair-001',
        caseId,
        ifCaseRevision: 3,
        parentNodeId: hypothesisId,
        changeSummary: 'deploy socket cleanup patch'
      });
      const repairAttemptId = repairAttempt.createdIds?.find((value) => value.startsWith('repair_attempt_'))!;

      const result = await app.mcpServer.invokeTool('investigation.evidence.capture_and_attach', {
        idempotencyKey: 'canonical-evidence-capture-and-attach-001',
        caseId,
        ifCaseRevision: 4,
        parentNodeId: repairAttemptId,
        kind: 'experiment_result',
        title: 'Patch validation run',
        summary: 'Validation run shows socket count remains stable.',
        provenance: 'validation-job-001',
        effectOnParent: 'validates',
        interpretation: 'The patch behaves as expected.'
      });

      expect(result.createdIds?.some((value) => value.startsWith('evidence_'))).toBe(true);
      expect(result.createdIds?.some((value) => value.startsWith('evidence_ref_'))).toBe(true);
    } finally {
      await app.close();
    }
  });
});
