import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';
describe.sequential('legacy panel resources', () => {
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

  test('are no longer exposed once the canonical graph inspector owns node detail reads', async () => {
    const app = await createTestApp();

    try {
      const opened = await app.mcpServer.invokeTool('investigation.case.open', {
        idempotencyKey: 'panel-history-open-001',
        title: 'Removed panel resources',
        objective: 'Ensure panel resources stay unavailable',
        severity: 'medium',
        projectDirectory: '/workspace/panel-history-open-001'
      });
      const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
      const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;
      const hypothesis = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
        idempotencyKey: 'panel-history-hypothesis-001',
        caseId,
        ifCaseRevision: 1,
        parentNodeId: problemId,
        statement: 'removed panel hypothesis',
        falsificationCriteria: ['removed panel falsification']
      });
      const hypothesisId = hypothesis.createdIds?.find((value) => value.startsWith('hypothesis_'))!;

      await expect(
        app.mcpServer.readResource(
          `investigation://cases/${caseId}/hypotheses/${hypothesisId}?atRevision=2`
        )
      ).rejects.toThrow(/Unknown resource/);

      await expect(
        app.mcpServer.readResource(
          `investigation://cases/${caseId}/inquiries/inquiry_01AAAAAAAAAAAAAAAAAAAA?atRevision=1`
        )
      ).rejects.toThrow(/Unknown resource/);
    } finally {
      await app.close();
    }
  });
});
