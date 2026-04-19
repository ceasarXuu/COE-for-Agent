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
          problems: 1,
          hypotheses: 0,
          blockers: 0,
          repairAttempts: 0,
          evidenceRefs: 0
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
            eventType: 'case.opened',
            editorOrigin: 'web_ui'
          })
        ])
      }
    });

    await app.close();
  });

  test('timeline marks agent-authored mutations separately from web ui edits', async () => {
    const app = await createTestApp();
    const opened = await app.mcpServer.invokeTool('investigation.case.open', {
      idempotencyKey: 'timeline-origin-open',
      title: 'Timeline origin',
      objective: 'Mark origin labels in hover bubbles',
      severity: 'high',
      projectDirectory: '/workspace/timeline-origin'
    });
    const caseId = opened.createdIds?.find((value) => value.startsWith('case_'))!;
    const problemId = opened.createdIds?.find((value) => value.startsWith('problem_'))!;

    await app.mcpServer.invokeTool('investigation.hypothesis.create', {
      idempotencyKey: 'timeline-origin-agent',
      caseId,
      ifCaseRevision: opened.headRevisionAfter,
      parentNodeId: problemId,
      statement: 'agent hypothesis',
      falsificationCriteria: ['disprove agent hypothesis'],
      actorContext: {
        actorType: 'agent',
        actorId: 'codex-agent',
        sessionId: 'agent-session',
        role: 'Reviewer',
        issuer: 'codex',
        authMode: 'service'
      }
    });

    const timeline = await app.mcpServer.readResource(`investigation://cases/${caseId}/timeline`);

    expect(timeline.data).toMatchObject({
      data: {
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'case.opened',
            editorOrigin: 'web_ui'
          }),
          expect.objectContaining({
            eventType: 'canonical.hypothesis.created',
            editorOrigin: 'agent'
          })
        ])
      }
    });

    await app.close();
  });
});
