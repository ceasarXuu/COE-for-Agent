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

    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/snapshot?revision=4',
      headers: { 'x-session-token': session.sessionToken }
    });

    expect(response.statusCode).toBe(200);
    expect(readResource).toHaveBeenCalledWith(
      'investigation://cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/snapshot?atRevision=4'
    );
  });

  test('GET /api/cases/:caseId/snapshot rejects reads without an explicit session token', async () => {
    const readResource = vi.fn();

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
      url: '/api/cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/snapshot'
    });

    expect(response.statusCode).toBe(401);
    expect(readResource).not.toHaveBeenCalled();
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/diff?from=3&to=5',
      headers: { 'x-session-token': session.sessionToken }
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
      url: '/api/tools/investigation.case.close',
      headers: {
        'x-session-token': session.sessionToken
      },
      payload: {
        caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        ifCaseRevision: 5,
        reason: 'validated and ready to close',
        confirmToken: 'confirm-token-1'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(invokeTool).toHaveBeenCalledWith('investigation.case.close', {
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      ifCaseRevision: 5,
      reason: 'validated and ready to close',
      confirmToken: 'confirm-token-1',
      actorContext: session.actorContext
    });
  });

  test('POST /api/tools/:toolName rejects writes without an explicit session token', async () => {
    const invokeTool = vi.fn();

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
      url: '/api/tools/investigation.case.close',
      payload: {
        caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        ifCaseRevision: 5,
        reason: 'validated and ready to close'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      message: 'x-session-token header is required for console write requests'
    });
    expect(invokeTool).not.toHaveBeenCalled();
  });

  test('POST /api/tools/:toolName rejects unknown investigation tools before invoking MCP', async () => {
    const invokeTool = vi.fn();

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
      url: '/api/tools/investigation.legacy.fact.assert',
      payload: {}
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      message: 'Unknown investigation tool: investigation.legacy.fact.assert'
    });
    expect(invokeTool).not.toHaveBeenCalled();
  });

  test('POST /api/confirm-intent rejects confirmation without an explicit session token', async () => {
    const app = await buildConsoleServer({
      mcpClient: {
        readResource: vi.fn(),
        invokeTool: vi.fn(),
        close: vi.fn()
      },
      sessionSecret: 'local-test-secret'
    });
    servers.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/confirm-intent',
      payload: {
        commandName: 'investigation.case.close',
        caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
        targetIds: ['case_01AAAAAAAAAAAAAAAAAAAAAAAA'],
        rationale: 'validated and ready to close'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      message: 'x-session-token header is required for console write requests'
    });
  });
});
