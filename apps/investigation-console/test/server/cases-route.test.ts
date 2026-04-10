import { afterEach, describe, expect, test, vi } from 'vitest';

import { buildConsoleServer } from '../../server/index.js';

describe('cases route', () => {
  const servers: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      await servers.pop()?.close();
    }
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

  test('POST /api/cases opens a case with reviewer context and returns the created identifiers', async () => {
    const invokeTool = vi.fn(async () => ({
      ok: true,
      createdIds: [
        'case_01BBBBBBBBBBBBBBBBBBBBBBBB',
        'inquiry_01BBBBBBBBBBBBBBBBBBBBB'
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

    const response = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: {
        title: 'Manual case from console',
        objective: 'Capture a new investigation from the gallery entry point',
        severity: 'high',
        environment: ['prod-eu-1'],
        labels: ['manual-entry']
      }
    });

    expect(response.statusCode).toBe(200);
    expect(invokeTool).toHaveBeenCalledWith('investigation.case.open', expect.objectContaining({
      title: 'Manual case from console',
      objective: 'Capture a new investigation from the gallery entry point',
      severity: 'high',
      environment: ['prod-eu-1'],
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
    expect(response.json()).toMatchObject({
      ok: true,
      caseId: 'case_01BBBBBBBBBBBBBBBBBBBBBBBB',
      inquiryId: 'inquiry_01BBBBBBBBBBBBBBBBBBBBB',
      headRevisionAfter: 1
    });
  });
});
