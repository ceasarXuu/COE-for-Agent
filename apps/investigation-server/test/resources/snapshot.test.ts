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
    const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

    const snapshot = await app.mcpServer.readResource(`investigation://cases/${caseId}/snapshot`);
    const graph = await app.mcpServer.readResource(`investigation://cases/${caseId}/graph`);
    const timeline = await app.mcpServer.readResource(`investigation://cases/${caseId}/timeline`);

    expect(snapshot.data).toMatchObject({
      data: {
        case: {
          id: caseId,
          title: 'Login timeout',
          severity: 'critical',
          projectDirectory: '/workspace/snapshot-open',
          defaultProblemId: problemId
        },
        counts: {
          inquiries: 0,
          symptoms: 0,
          artifacts: 0,
          facts: 0
        }
      }
    });
    expect(graph.data).toMatchObject({
      data: {
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: problemId,
            kind: 'problem',
            status: 'open'
          })
        ])
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
