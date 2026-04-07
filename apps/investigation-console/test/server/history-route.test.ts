import { afterEach, describe, expect, test, vi } from 'vitest';

import { createLocalSession } from '../../server/auth/session.js';
import { buildConsoleServer } from '../../server/index.js';

describe('history and tools routes', () => {
  const servers: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      await servers.pop()?.close();
    }
  });

  test('GET /api/cases/:caseId/snapshot forwards revision-aware reads', async () => {
    const readResource = vi.fn(async (uri: string) => ({
      uri,
      mimeType: 'application/json' as const,
      data: { requestedRevision: 4 }
    }));

    const app = await buildConsoleServer({
      mcpClient: {
        readResource,
        invokeTool: vi.fn(),
        close: vi.fn()
      },
      sessionSecret: 'local-test-secret'
    });
    servers.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/snapshot?revision=4'
    });

    expect(response.statusCode).toBe(200);
    expect(readResource).toHaveBeenCalledWith(
      'investigation://cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/snapshot?atRevision=4'
    );
  });

  test('GET /api/cases/:caseId/diff forwards the diff range', async () => {
    const readResource = vi.fn(async (uri: string) => ({
      uri,
      mimeType: 'application/json' as const,
      data: { fromRevision: 3, toRevision: 5 }
    }));

    const app = await buildConsoleServer({
      mcpClient: {
        readResource,
        invokeTool: vi.fn(),
        close: vi.fn()
      },
      sessionSecret: 'local-test-secret'
    });
    servers.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/diff?from=3&to=5'
    });

    expect(response.statusCode).toBe(200);
    expect(readResource).toHaveBeenCalledWith(
      'investigation://cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/diff?fromRevision=3&toRevision=5'
    );
  });

  test('POST /api/tools/:toolName attaches actorContext and confirmToken', async () => {
    const invokeTool = vi.fn(async () => ({
      ok: true,
      headRevisionBefore: 5,
      headRevisionAfter: 6,
      projectionScheduled: false,
      warnings: [],
      violations: []
    }));
    const session = createLocalSession(
      {
        actorType: 'user',
        actorId: 'reviewer-1',
        role: 'Reviewer',
        issuer: 'local-test',
        authMode: 'local'
      },
      'local-test-secret'
    );

    const app = await buildConsoleServer({
      mcpClient: {
        readResource: vi.fn(),
        invokeTool,
        close: vi.fn()
      },
      sessionSecret: 'local-test-secret'
    });
    servers.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/tools/investigation.case.advance_stage',
      headers: {
        'x-session-token': session.sessionToken
      },
      payload: {
        caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        ifCaseRevision: 5,
        stage: 'repair_preparation',
        reason: 'ready for patch assembly',
        confirmToken: 'confirm-token-1'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(invokeTool).toHaveBeenCalledWith('investigation.case.advance_stage', {
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      ifCaseRevision: 5,
      stage: 'repair_preparation',
      reason: 'ready for patch assembly',
      confirmToken: 'confirm-token-1',
      actorContext: session.actorContext
    });
  });
});