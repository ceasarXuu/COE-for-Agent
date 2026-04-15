import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('issue and context compatibility commands', () => {
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

  test('issue.record opens a question branch through the canonical issue interface', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'issue-open-case-001',
        title: 'Issue branch alias',
        objective: 'Exercise canonical issue command aliases',
        severity: 'high',
        projectDirectory: '/workspace/issue-open-case-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const result = await app.mcpServer.invokeTool('investigation.issue.record', {
        idempotencyKey: 'issue-record-question-001',
        caseId,
        ifCaseRevision: 1,
        issueKind: 'question',
        title: 'Queue branch',
        summary: 'Does queue replay explain the duplicate writes?',
        priority: 'high',
        scopeRefs: ['entity_01PLACEHOLDER']
      });

      expect(result.createdIds?.some((value) => value.startsWith('inquiry_'))).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('issue.record and issue.resolve route unresolved items to legacy gap and residual commands', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'issue-open-case-002',
        title: 'Issue unresolved alias',
        objective: 'Exercise unresolved issue aliases',
        severity: 'critical',
        projectDirectory: '/workspace/issue-open-case-002'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const blockingIssue = await app.mcpServer.invokeTool('investigation.issue.record', {
        idempotencyKey: 'issue-record-blocking-001',
        caseId,
        ifCaseRevision: 1,
        issueKind: 'unresolved',
        title: 'Patch blocker',
        summary: 'We still lack the validation step for the favored branch.',
        priority: 'critical',
        blocking: true,
        blockedRefs: ['hypothesis_01PLACEHOLDER']
      });
      const gapId = blockingIssue.createdIds?.find((value) => value.startsWith('gap_'))!;

      const resolvedGap = await app.mcpServer.invokeTool('investigation.issue.resolve', {
        idempotencyKey: 'issue-resolve-gap-001',
        caseId,
        ifCaseRevision: 2,
        issueId: gapId,
        resolution: 'resolved',
        rationale: 'Validation evidence is now attached.'
      });

      expect(resolvedGap.updatedIds).toContain(gapId);

      const residualIssue = await app.mcpServer.invokeTool('investigation.issue.record', {
        idempotencyKey: 'issue-record-residual-001',
        caseId,
        ifCaseRevision: 3,
        issueKind: 'unresolved',
        title: 'Residual variance',
        summary: 'Tenant A remains noisier than the rest of the fleet.',
        priority: 'medium',
        blocking: false
      });
      const residualId = residualIssue.createdIds?.find((value) => value.startsWith('residual_'))!;

      const resolvedResidual = await app.mcpServer.invokeTool('investigation.issue.resolve', {
        idempotencyKey: 'issue-resolve-residual-001',
        caseId,
        ifCaseRevision: 4,
        issueId: residualId,
        resolution: 'resolved',
        rationale: 'Follow-up mitigation has been completed.'
      });

      expect(resolvedResidual.updatedIds).toContain(residualId);
    } finally {
      await app.close();
    }
  });

  test('context.register keeps entity storage compatible while exposing a simpler name', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'context-open-case-001',
        title: 'Context alias',
        objective: 'Exercise canonical context registration alias',
        severity: 'medium',
        projectDirectory: '/workspace/context-open-case-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const result = await app.mcpServer.invokeTool('investigation.context.register', {
        idempotencyKey: 'context-register-001',
        caseId,
        ifCaseRevision: 1,
        contextKind: 'service',
        name: 'order-write-api',
        locator: {
          service: 'order-write-api'
        }
      });

      expect(result.createdIds?.some((value) => value.startsWith('entity_'))).toBe(true);
    } finally {
      await app.close();
    }
  });
});
