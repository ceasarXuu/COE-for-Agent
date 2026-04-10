import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  assertServerTestDatabaseAvailable,
  createAdminPool,
  createTestApp,
  resetServerTestDatabase
} from '../test-app.js';

describe.sequential('snapshot and timeline resources', () => {
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

  test('snapshot exposes case summary and synchronous counts after case.open', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'snapshot-open',
      title: 'Login timeout',
      objective: 'Locate the blocking service',
      severity: 'critical',
      projectDirectory: '/workspace/snapshot-open'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
    const inquiryId = opened.createdIds?.find((value) => value.startsWith('inquiry_'))!;

    const snapshot = await app.mcpServer.readResource(`investigation://cases/${caseId}/snapshot`);
    const inquiryPanel = await app.mcpServer.readResource(`investigation://cases/${caseId}/inquiries/${inquiryId}`);
    const timeline = await app.mcpServer.readResource(`investigation://cases/${caseId}/timeline`);

    expect(snapshot.data).toMatchObject({
      data: {
        case: {
          id: caseId,
          title: 'Login timeout',
          severity: 'critical',
          projectDirectory: '/workspace/snapshot-open'
        },
        counts: {
          inquiries: 1,
          symptoms: 0,
          artifacts: 0,
          facts: 0
        }
      }
    });
    expect(inquiryPanel.data).toMatchObject({
      data: {
        inquiry: {
          id: inquiryId,
          title: 'Default inquiry',
          status: 'open'
        }
      }
    });
    expect(timeline.data).toMatchObject({
      data: {
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'case.opened'
          })
        ])
      }
    });

    await app.close();
  });
});
