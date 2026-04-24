import { afterEach, describe, expect, test, vi } from 'vitest';

import { resolveLocalSession } from '../../server/auth/session.js';
import { buildConsoleServer } from '../../server/index.js';

describe('cases route', () => {
  const servers: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      await servers.pop()?.close();
    }
    vi.useRealTimers();
  });

  test('GET /api/cases proxies the collection resource with query params', async () => {
    const readResource = vi.fn(async (uri: string) => ({
      uri,
      mimeType: 'application/json' as const,
      data: {
        items: [{ caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA' }]
      }
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
      url: '/api/cases?status=active&sort=updatedAt:desc&page=2'
    });

    expect(response.statusCode).toBe(200);
    expect(readResource).toHaveBeenCalledWith('investigation://cases?status=active&sort=updatedAt%3Adesc&page=2');
    expect(response.json()).toMatchObject({
      items: [{ caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA' }]
    });
  });

  test('POST /api/cases opens a case with reviewer context and returns only canonical created identifiers', async () => {
    const invokeTool = vi.fn(async () => ({
      ok: true,
      createdIds: [
        'case_01BBBBBBBBBBBBBBBBBBBBBBBB',
        'problem_01BBBBBBBBBBBBBBBBBBBBB'
      ],
      headRevisionAfter: 1
    }));

    const app = await buildConsoleServer({
      mcpClient: {
        readResource: vi.fn(),
        invokeTool,
        close: vi.fn()
      },
      sessionSecret: 'local-test-secret'
    });
    servers.push(app);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/session'
    });
    const session = sessionResponse.json() as { sessionToken: string };

    const response = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: {
        'x-session-token': session.sessionToken
      },
      payload: {
        title: 'Manual case from console',
        objective: 'Capture a new investigation from the gallery entry point',
        severity: 'high',
        projectDirectory: '/workspace/customer-a',
        labels: ['manual-entry']
      }
    });

    expect(response.statusCode).toBe(200);
    expect(invokeTool).toHaveBeenCalledWith('investigation.case.open', expect.objectContaining({
      title: 'Manual case from console',
      objective: 'Capture a new investigation from the gallery entry point',
      severity: 'high',
      projectDirectory: '/workspace/customer-a',
      labels: ['manual-entry'],
      idempotencyKey: expect.any(String),
      actorContext: expect.objectContaining({
        actorType: 'user',
        actorId: 'console-reviewer',
        role: 'Reviewer',
        issuer: 'local-console',
        authMode: 'local',
        sessionId: expect.any(String)
      })
    }));
    expect(invokeTool).toHaveBeenCalledTimes(1);
    const firstCall = invokeTool.mock.calls.at(0);
    if (!firstCall) {
      throw new Error('expected invokeTool to be called once');
    }
    const invokedPayload = (firstCall as unknown as unknown[])[1] as Record<string, unknown>;
    expect(invokedPayload).not.toHaveProperty('environment');
    expect(response.json()).toMatchObject({
      ok: true,
      caseId: 'case_01BBBBBBBBBBBBBBBBBBBBBBBB',
      problemId: 'problem_01BBBBBBBBBBBBBBBBBBBBB',
      headRevisionAfter: 1
    });
    expect(response.json()).not.toHaveProperty('inquiryId');
  });

  test('POST /api/cases rejects writes without an explicit session token', async () => {
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
      url: '/api/cases',
      payload: {
        title: 'Manual case from console',
        objective: 'Capture a new investigation from the gallery entry point',
        severity: 'high',
        projectDirectory: '/workspace/customer-a'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      message: 'x-session-token header is required for console write requests'
    });
    expect(invokeTool).not.toHaveBeenCalled();
  });

  test('GET /api/session issues a still-valid session after the server has been running past the session TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T00:00:00.000Z'));

    const app = await buildConsoleServer({
      mcpClient: {
        readResource: vi.fn(),
        invokeTool: vi.fn(),
        close: vi.fn()
      },
      sessionSecret: 'local-test-secret'
    });
    servers.push(app);

    vi.advanceTimersByTime(9 * 60 * 60 * 1000);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/session'
    });
    const session = sessionResponse.json() as {
      sessionToken: string;
      expiresAt: string;
    };

    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(resolveLocalSession(session.sessionToken, 'local-test-secret')).toMatchObject({
      actorType: 'user',
      actorId: 'console-reviewer',
      role: 'Reviewer',
      issuer: 'local-console',
      authMode: 'local'
    });
  });
});
