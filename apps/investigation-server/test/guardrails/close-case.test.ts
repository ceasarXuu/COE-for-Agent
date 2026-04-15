import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('close_case guardrail', () => {
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

  test('fails while the default inquiry is still open and the case is not in repair_validation', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'close-open-001',
        title: 'Cannot close yet',
        objective: 'Verify close-case blockers',
        severity: 'medium',
        projectDirectory: '/workspace/close-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;

      const result = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId
      });

      expect(result).toMatchObject({
        pass: false,
        blockingInquiryIds: expect.arrayContaining([inquiryId]),
        blockingIssueIds: expect.arrayContaining([inquiryId])
      });
    } finally {
      await app.close();
    }
  });

  test('still fails without validation evidence after inquiries are closed and residuals are accepted', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'close-open-002',
        title: 'Validation still missing',
        objective: 'Advance lifecycle before running close-case guardrail',
        severity: 'high',
        projectDirectory: '/workspace/close-open-002'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;
      let revision = 1;

      const closedInquiry = await app.mcpServer.invokeTool('investigation.inquiry.close', {
        idempotencyKey: 'close-inquiry-002',
        caseId,
        ifCaseRevision: revision,
        inquiryId,
        resolutionKind: 'answered',
        reason: 'initial branch resolved'
      });
      revision = closedInquiry.headRevisionAfter;

      for (const stage of [
        'scoping',
        'evidence_collection',
        'hypothesis_competition',
        'discriminative_testing',
        'repair_preparation',
        'repair_validation'
      ] as const) {
        const advanced = await app.mcpServer.invokeTool('investigation.case.advance_stage', {
          idempotencyKey: `advance-${stage}`,
          caseId,
          ifCaseRevision: revision,
          stage
        });
        revision = advanced.headRevisionAfter;
      }

      const residual = await app.mcpServer.invokeTool('investigation.residual.open', {
        idempotencyKey: 'close-residual-open-001',
        caseId,
        ifCaseRevision: revision,
        statement: 'low-volume duplicate may still happen during failover',
        severity: 'critical'
      });
      revision = residual.headRevisionAfter;
      const residualId = residual.createdIds?.find((value) => value.startsWith('residual_'))!;

      const accepted = await app.mcpServer.invokeTool('investigation.residual.update', {
        idempotencyKey: 'close-residual-update-001',
        caseId,
        ifCaseRevision: revision,
        residualId,
        newStatus: 'accepted',
        rationale: 'tracked for a later hardening sprint'
      });

      const result = await app.mcpServer.invokeTool('investigation.guardrail.close_case_check', {
        caseId
      });

      expect(accepted.headRevisionAfter).toBeGreaterThan(revision);
      expect(result).toMatchObject({
        pass: false,
        blockingInquiryIds: [],
        blockingResidualIds: [],
        blockingIssueIds: [],
        reasons: expect.arrayContaining([expect.stringMatching(/validation/i)])
      });
    } finally {
      await app.close();
    }
  });
});
