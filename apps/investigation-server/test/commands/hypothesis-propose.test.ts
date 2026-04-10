import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('hypothesis and experiment commands', () => {
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

  test('rejects hypothesis.propose without falsificationCriteria', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'hypothesis-open-001',
        title: 'Missing falsification criteria',
        objective: 'Test schema validation',
        severity: 'high',
        projectDirectory: '/workspace/hypothesis-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;

      const symptom = await app.mcpServer.invokeTool('investigation.symptom.report', {
        idempotencyKey: 'hypothesis-symptom-001',
        caseId,
        ifCaseRevision: 1,
        statement: 'cache entries reappear after invalidation',
        severity: 'high',
        reproducibility: 'often'
      });
      const symptomId = symptom.createdIds?.find((value) => value.startsWith('symptom_'))!;

      await expect(
        app.mcpServer.invokeTool('investigation.hypothesis.propose', {
          idempotencyKey: 'hypothesis-propose-001',
          caseId,
          ifCaseRevision: 2,
          inquiryId,
          title: 'write path skips invalidation',
          statement: 'the cache invalidation branch does not execute',
          level: 'mechanism',
          explainsSymptomIds: [symptomId]
        })
      ).rejects.toThrow(/falsificationCriteria/i);
    } finally {
      await app.close();
    }
  });

  test('rejects experiment.plan without expectedOutcomes', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'experiment-open-001',
        title: 'Missing expected outcomes',
        objective: 'Test experiment schema validation',
        severity: 'medium',
        projectDirectory: '/workspace/experiment-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;

      await expect(
        app.mcpServer.invokeTool('investigation.experiment.plan', {
          idempotencyKey: 'experiment-plan-001',
          caseId,
          ifCaseRevision: 1,
          inquiryId,
          title: 'probe invalidation branch',
          objective: 'confirm whether invalidation runs',
          method: 'instrumentation',
          testsHypothesisIds: ['hypothesis_01JQ9Y2D3E5H7K9M1N2P3Q4R5S']
        })
      ).rejects.toThrow(/expectedOutcomes/i);
    } finally {
      await app.close();
    }
  });

  test('creates a hypothesis and exposes it through the hypothesis panel resource', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'hypothesis-open-002',
        title: 'Duplicate webhook deliveries',
        objective: 'Find the branch that duplicates sends',
        severity: 'critical',
        projectDirectory: '/workspace/hypothesis-open-002'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;

      const symptom = await app.mcpServer.invokeTool('investigation.symptom.report', {
        idempotencyKey: 'hypothesis-symptom-002',
        caseId,
        ifCaseRevision: 1,
        statement: 'customers receive the same webhook twice',
        severity: 'critical',
        reproducibility: 'always'
      });
      const symptomId = symptom.createdIds?.find((value) => value.startsWith('symptom_'))!;

      const proposed = await app.mcpServer.invokeTool('investigation.hypothesis.propose', {
        idempotencyKey: 'hypothesis-propose-002',
        caseId,
        ifCaseRevision: 2,
        inquiryId,
        title: 'retry guard is bypassed',
        statement: 'the retry guard does not persist its completion marker',
        level: 'mechanism',
        explainsSymptomIds: [symptomId],
        falsificationCriteria: ['completion marker exists before second enqueue']
      });
      const hypothesisId = proposed.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      const panel = await app.mcpServer.readResource(`investigation://cases/${caseId}/hypotheses/${hypothesisId}`);

      expect(panel.data).toMatchObject({
        data: {
          hypothesis: {
            id: hypothesisId,
            status: 'proposed',
            title: 'retry guard is bypassed'
          },
          supportingFacts: [],
          linkedExperiments: [],
          openGaps: [],
          openResiduals: []
        }
      });
    } finally {
      await app.close();
    }
  });
});
