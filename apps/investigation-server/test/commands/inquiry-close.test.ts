import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

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

  test('case.open auto-creates a default inquiry', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'open-default-inquiry',
      title: 'Payment retry loop',
      objective: 'Find why retries never stop',
      severity: 'critical'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'));
    const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'));

    expect(caseId).toMatch(/^case_/);
    expect(inquiryId).toMatch(/^inquiry_/);

    const inquiryPanel = await app.mcpServer.readResource(`investigation://cases/${caseId}/inquiries/${inquiryId}`);
    expect(inquiryPanel.data).toMatchObject({
      data: {
        inquiry: {
          id: inquiryId,
          status: 'open'
        }
      }
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
        severity: 'critical' as const
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

  test('inquiry.close updates inquiry lifecycle and writes inquiry.closed to timeline', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'open-close-inquiry',
      title: 'Webhook duplication',
      objective: 'Close initial inquiry after confirmation',
      severity: 'high'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
    const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;

    const closed = await app.mcpServer.invokeTool('investigation.inquiry.close', {
      idempotencyKey: 'close-inquiry-001',
      caseId,
      ifCaseRevision: 1,
      inquiryId,
      resolutionKind: 'answered',
      reason: 'Root branch closed'
    });

    expect(closed.headRevisionAfter).toBe(2);

    const inquiryPanel = await app.mcpServer.readResource(`investigation://cases/${caseId}/inquiries/${inquiryId}`);
    expect(inquiryPanel.data).toMatchObject({
      data: {
        inquiry: {
          id: inquiryId,
          status: 'closed',
          resolutionKind: 'answered'
        }
      }
    });

    const timeline = await app.mcpServer.readResource(`investigation://cases/${caseId}/timeline`);
    expect(timeline.data).toMatchObject({
      data: {
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'inquiry.closed'
          })
        ])
      }
    });

    await app.close();
  });
});