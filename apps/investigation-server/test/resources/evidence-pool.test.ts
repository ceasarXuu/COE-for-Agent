import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('evidence pool resource', () => {
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

  test('returns shared canonical evidence entities for a case', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'evidence-pool-open-001',
        title: 'Evidence pool',
        objective: 'Read the evidence pool resource',
        severity: 'high',
        projectDirectory: '/workspace/evidence-pool-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;

      const captured = await app.mcpServer.invokeTool('investigation.evidence.capture', {
        idempotencyKey: 'evidence-pool-capture-001',
        caseId,
        ifCaseRevision: 1,
        kind: 'log',
        title: 'Pool saturation log',
        summary: 'The pool saturates before the request failure.',
        provenance: 'worker.log'
      });
      const evidenceId = captured.createdIds?.find((value) => value.startsWith('evidence_'))!;

      const resource = await app.mcpServer.readResource(`investigation://cases/${caseId}/evidence-pool`);

      expect(resource.data).toMatchObject({
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              evidenceId,
              kind: 'log',
              title: 'Pool saturation log'
            })
          ])
        }
      });
    } finally {
      await app.close();
    }
  });
});
