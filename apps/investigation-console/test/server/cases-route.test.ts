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
});