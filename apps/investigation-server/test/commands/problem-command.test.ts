import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { CurrentStateRepository } from '@coe/persistence';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('canonical problem commands', () => {
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

  test('case.open creates a canonical problem root alongside the legacy inquiry', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'problem-open-001',
        title: 'Canonical problem bootstrap',
        objective: 'Ensure a canonical problem root exists for new cases',
        severity: 'high',
        projectDirectory: '/workspace/problem-open-001'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      expect(problemId).toBeTruthy();

      const currentState = new CurrentStateRepository(app.services.db);
      const problemRecord = await currentState.getRecord('problems', problemId);

      expect(problemRecord).toMatchObject({
        id: problemId,
        caseId,
        status: 'open'
      });
    } finally {
      await app.close();
    }
  });

  test('problem.update patches the canonical problem payload', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'problem-open-002',
        title: 'Problem update flow',
        objective: 'Verify canonical problem updates',
        severity: 'critical',
        projectDirectory: '/workspace/problem-open-002'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const updated = await app.mcpServer.invokeTool('investigation.problem.update', {
        idempotencyKey: 'problem-update-001',
        caseId,
        ifCaseRevision: 1,
        problemId,
        environment: 'prod-us-east-1',
        symptoms: ['requests timeout after 30s'],
        resolutionCriteria: ['requests complete under 2 seconds at p95']
      });

      expect(updated.updatedIds).toContain(problemId);

      const currentState = new CurrentStateRepository(app.services.db);
      const problemRecord = await currentState.getRecord('problems', problemId);

      expect(problemRecord?.payload).toMatchObject({
        environment: 'prod-us-east-1',
        symptoms: ['requests timeout after 30s'],
        resolutionCriteria: ['requests complete under 2 seconds at p95']
      });
    } finally {
      await app.close();
    }
  });

  test('problem.set_status enforces the canonical problem state machine', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'problem-open-003',
        title: 'Problem status flow',
        objective: 'Verify canonical problem status transitions',
        severity: 'medium',
        projectDirectory: '/workspace/problem-open-003'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const resolved = await app.mcpServer.invokeTool('investigation.problem.set_status', {
        idempotencyKey: 'problem-status-001',
        caseId,
        ifCaseRevision: 1,
        problemId,
        newStatus: 'resolved',
        reason: 'manual test closure'
      });

      expect(resolved.updatedIds).toContain(problemId);

      await expect(
        app.mcpServer.invokeTool('investigation.problem.set_status', {
          idempotencyKey: 'problem-status-002',
          caseId,
          ifCaseRevision: 2,
          problemId,
          newStatus: 'abandoned',
          reason: 'should fail once resolved'
        })
      ).rejects.toThrow(/Invalid problem transition/);
    } finally {
      await app.close();
    }
  });

  test('problem.add_reference_material appends structured materials to the canonical root', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'problem-open-004',
        title: 'Problem material flow',
        objective: 'Verify problem reference materials are tracked',
        severity: 'low',
        projectDirectory: '/workspace/problem-open-004'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

      const result = await app.mcpServer.invokeTool('investigation.problem.add_reference_material', {
        idempotencyKey: 'problem-material-001',
        caseId,
        ifCaseRevision: 1,
        problemId,
        materialKind: 'log',
        title: 'Initial operator log bundle',
        contentRef: 'artifact://logs/problem-open-004'
      });

      expect(result.createdIds?.some((value) => value.startsWith('reference_material_'))).toBe(true);
      expect(result.updatedIds).toContain(problemId);

      const currentState = new CurrentStateRepository(app.services.db);
      const problemRecord = await currentState.getRecord('problems', problemId);
      const payload = (problemRecord?.payload ?? {}) as { referenceMaterials?: Array<Record<string, unknown>> };

      expect(payload.referenceMaterials).toEqual([
        expect.objectContaining({
          kind: 'log',
          title: 'Initial operator log bundle',
          contentRef: 'artifact://logs/problem-open-004'
        })
      ]);
    } finally {
      await app.close();
    }
  });

  test('saved canonical nodes can be updated after creation', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'problem-open-005',
        title: 'Canonical node updates',
        objective: 'Verify saved canonical nodes remain editable',
        severity: 'high',
        projectDirectory: '/workspace/problem-open-005'
      });

      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;
      const createdHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'problem-open-005-hypothesis',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'initial hypothesis',
        falsificationCriteria: ['initial falsification']
      });
      const hypothesisId = createdHypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const updatedHypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.update', {
        idempotencyKey: 'problem-open-005-hypothesis-update',
        caseId,
        ifCaseRevision: 2,
        hypothesisId,
        statement: 'updated hypothesis',
        falsificationCriteria: ['updated falsification']
      });

      expect(updatedHypothesis.updatedIds).toContain(hypothesisId);

      const openedBlocker = await app.mcpServer.invokeTool('investigation.blocker.open', {
        idempotencyKey: 'problem-open-005-blocker',
        caseId,
        ifCaseRevision: 3,
        hypothesisId,
        description: 'initial blocker'
      });
      const blockerId = openedBlocker.createdIds?.find((value) => value.startsWith('blocker_'))!;

      const updatedBlocker = await app.mcpServer.invokeTool('investigation.blocker.update', {
        idempotencyKey: 'problem-open-005-blocker-update',
        caseId,
        ifCaseRevision: 4,
        blockerId,
        description: 'updated blocker',
        possibleWorkarounds: ['new workaround']
      });

      expect(updatedBlocker.updatedIds).toContain(blockerId);

      const currentState = new CurrentStateRepository(app.services.db);
      const hypothesisRecord = await currentState.getRecord('hypotheses', hypothesisId);
      const blockerRecord = await currentState.getRecord('blockers', blockerId);

      expect(hypothesisRecord?.payload).toMatchObject({
        statement: 'updated hypothesis',
        falsificationCriteria: ['updated falsification']
      });
      expect(blockerRecord?.payload).toMatchObject({
        description: 'updated blocker',
        possibleWorkarounds: ['new workaround']
      });
    } finally {
      await app.close();
    }
  });
});
