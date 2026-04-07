import type { FastifyInstance } from 'fastify';

import type { ConsoleMcpClient } from '../mcp-types.js';

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

export async function registerCasesRoutes(app: FastifyInstance, options: { mcpClient: ConsoleMcpClient }) {
  app.get('/api/cases', async (request) => {
    const query = typeof request.query === 'object' && request.query !== null
      ? (request.query as Record<string, unknown>)
      : {};
    const resource = await options.mcpClient.readResource(`investigation://cases${buildQueryString(query)}`);

    return resource.data;
  });
}