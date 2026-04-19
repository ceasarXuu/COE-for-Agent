import { afterEach, describe, expect, test, vi } from 'vitest';

describe('session-aware API writes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('refreshes the cached session before a write action once the token has expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T00:00:00.000Z'));

    let issuedSessions = 0;

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/session') {
        issuedSessions += 1;
        return new Response(JSON.stringify({
          sessionToken: `session-token-${issuedSessions}`,
          actorContext: {
            actorType: 'user',
            actorId: 'console-reviewer',
            sessionId: `session-${issuedSessions}`,
            role: 'Reviewer',
            issuer: 'local-console',
            authMode: 'local'
          },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const sessionToken = (init?.headers as Record<string, string> | undefined)?.['x-session-token'];

      if (url === '/api/cases') {
        expect(sessionToken).toBe('session-token-1');
        return new Response(JSON.stringify({
          ok: true,
          caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
          inquiryId: null,
          problemId: 'problem_01AAAAAAAAAAAAAAAAAAAA',
          headRevisionAfter: 1
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/tools/investigation.case.advance_stage') {
        if (sessionToken !== 'session-token-2') {
          return new Response(JSON.stringify({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'sessionToken expired'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ok: true,
          headRevisionBefore: 1,
          headRevisionAfter: 2
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createCase, invokeTool } = await import('../src/lib/api.js');

    await createCase({
      idempotencyKey: 'case-open-1',
      title: 'test',
      objective: 'test2',
      severity: 'high',
      projectDirectory: '/workspace/project'
    });

    vi.advanceTimersByTime(2 * 60 * 60 * 1000);

    await invokeTool('investigation.case.advance_stage', {
      caseId: 'case_01AAAAAAAAAAAAAAAAAAAAAAAA',
      ifCaseRevision: 1,
      stage: 'scoping'
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/session');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/session');
  });
});
