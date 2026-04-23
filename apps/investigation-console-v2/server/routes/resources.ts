import type { FastifyInstance } from 'fastify';

import type { ConsoleMcpClient } from '../mcp-types.js';

function queryValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildCaseResourceUri(caseId: string, resourceName: string, search: URLSearchParams): string {
  const serialized = search.toString();
  return `investigation://cases/${caseId}/${resourceName}${serialized.length > 0 ? `?${serialized}` : ''}`;
}

export async function registerResourceRoutes(app: FastifyInstance, options: { mcpClient: ConsoleMcpClient }) {
  app.get('/api/cases/:caseId/snapshot', async (request) => {
    const params = request.params as { caseId: string };
    const query = request.query as Record<string, unknown>;
    const search = new URLSearchParams();
    const revision = queryValue(query, 'revision');
    if (revision) {
      search.set('atRevision', revision);
    }

    const resource = await options.mcpClient.readResource(buildCaseResourceUri(params.caseId, 'snapshot', search));
    return resource.data;
  });

  app.get('/api/cases/:caseId/timeline', async (request) => {
    const params = request.params as { caseId: string };
    const query = request.query as Record<string, unknown>;
    const search = new URLSearchParams();
    const revision = queryValue(query, 'revision');
    if (revision) {
      search.set('atRevision', revision);
    }

    const resource = await options.mcpClient.readResource(buildCaseResourceUri(params.caseId, 'timeline', search));
    return resource.data;
  });

  app.get('/api/cases/:caseId/graph', async (request) => {
    const params = request.params as { caseId: string };
    const query = request.query as Record<string, unknown>;
    const search = new URLSearchParams();
    const revision = queryValue(query, 'revision');
    const focusId = queryValue(query, 'focusId');
    const depth = queryValue(query, 'depth');
    if (revision) {
      search.set('atRevision', revision);
    }
    if (focusId) {
      search.set('focusId', focusId);
    }
    if (depth) {
      search.set('depth', depth);
    }

    const resource = await options.mcpClient.readResource(buildCaseResourceUri(params.caseId, 'graph', search));
    return resource.data;
  });

  app.get('/api/cases/:caseId/evidence-pool', async (request) => {
    const params = request.params as { caseId: string };
    const query = request.query as Record<string, unknown>;
    const search = new URLSearchParams();
    const revision = queryValue(query, 'revision');
    if (revision) {
      search.set('atRevision', revision);
    }

    const resource = await options.mcpClient.readResource(buildCaseResourceUri(params.caseId, 'evidence-pool', search));
    return resource.data;
  });

  app.get('/api/cases/:caseId/diff', async (request) => {
    const params = request.params as { caseId: string };
    const query = request.query as Record<string, unknown>;
    const search = new URLSearchParams();
    const from = queryValue(query, 'from');
    const to = queryValue(query, 'to');
    if (from) {
      search.set('fromRevision', from);
    }
    if (to) {
      search.set('toRevision', to);
    }

    const resource = await options.mcpClient.readResource(buildCaseResourceUri(params.caseId, 'diff', search));
    return resource.data;
  });
}
