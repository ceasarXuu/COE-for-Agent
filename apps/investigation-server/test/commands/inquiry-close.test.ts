import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { CurrentStateRepository } from '@coe/persistence';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('case.open and inquiry.close', () => {
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

  test('case.open bootstraps only the canonical problem root', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'open-default-inquiry',
      title: 'Payment retry loop',
      objective: 'Find why retries never stop',
      severity: 'critical',
      projectDirectory: '/workspace/open-default-inquiry'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'));
    const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'));

    expect(caseId).toMatch(/^case_/);
    expect(problemId).toMatch(/^problem_/);
    expect(opened.createdIds?.some((value) => value.startsWith('inquiry_'))).toBe(false);

    const currentState = new CurrentStateRepository(app.services.db);
    const problemRecord = await currentState.getRecord('problems', problemId!);

    expect(problemRecord).toMatchObject({
      id: problemId,
      status: 'open'
    });

    await app.close();
  });

  test('case.open reuses the original result for a duplicate idempotency key', async () => {
    const app = await createTestApp();

    try {
      const input = {
        idempotencyKey: 'open-duplicate-001',
        title: 'Payment retry loop',
        objective: 'Find why retries never stop',
        severity: 'critical' as const,
        projectDirectory: '/workspace/open-duplicate-001'
      };

      const first = await app.mcpServer.invokeTool('investigation.case.open', input);
      const second = await app.mcpServer.invokeTool('investigation.case.open', input);
      const cases = await app.mcpServer.readResource('investigation://cases');

      expect(second).toEqual(first);
      expect((cases.data as { data: { items: unknown[] } }).data.items).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  test('legacy inquiry.close is no longer exposed through the MCP surface', async () => {
    const app = await createTestApp();
    try {
      await expect(
        app.mcpServer.invokeTool('investigation.inquiry.close', {
          idempotencyKey: 'close-inquiry-001',
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          ifCaseRevision: 1,
          inquiryId: 'inquiry_01AAAAAAAAAAAAAAAAAAAA',
          resolutionKind: 'answered',
          reason: 'Root branch closed'
        })
      ).rejects.toThrow(/Unknown tool/);
    } finally {
      await app.close();
    }
  });
});
