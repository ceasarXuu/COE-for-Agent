import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('stall and aggregate guardrails', () => {
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

  test('returns an empty aggregate guardrail report for a fresh case', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'stall-open-001',
        title: 'Fresh guardrail aggregate',
        objective: 'Check aggregate structure',
        severity: 'low',
        projectDirectory: '/workspace/stall-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const result = await app.mcpServer.invokeTool('investigation.guardrail.check', {
        caseId
      });

      expect(result).toMatchObject({
        warnings: [],
        violations: []
      });
    } finally {
      await app.close();
    }
  });

  test('raises a stall signal when too many active hypotheses accumulate without resolution', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'stall-open-002',
        title: 'Hypothesis pileup',
        objective: 'Trigger a stall signal',
        severity: 'high',
        projectDirectory: '/workspace/stall-open-002'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;
      let revision = 1;

      const symptom = await app.mcpServer.invokeTool('investigation.symptom.report', {
        idempotencyKey: 'stall-symptom-001',
        caseId,
        ifCaseRevision: revision,
        statement: 'retries continue after success',
        severity: 'high',
        reproducibility: 'always'
      });
      revision = symptom.headRevisionAfter;
      const symptomId = symptom.createdIds?.find((value) => value.startsWith('symptom_'))!;

      for (const suffix of ['001', '002', '003', '004']) {
        const proposed = await app.mcpServer.invokeTool('investigation.hypothesis.propose', {
          idempotencyKey: `stall-hypothesis-${suffix}`,
          caseId,
          ifCaseRevision: revision,
          inquiryId,
          title: `candidate branch ${suffix}`,
          statement: `candidate branch ${suffix} keeps requeueing retries`,
          level: 'mechanism',
          explainsSymptomIds: [symptomId],
          falsificationCriteria: [`candidate branch ${suffix} stops after a single success`]
        });
        revision = proposed.headRevisionAfter;
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
