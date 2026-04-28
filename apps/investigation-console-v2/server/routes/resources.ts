import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { resolveLocalSession } from '../auth/session.js';
import type { ConsoleMcpClient } from '../mcp-types.js';

function queryValue(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildCaseResourceUri(caseId: string, resourceName: string, search: URLSearchParams): string {
  const serialized = search.toString();
  return `investigation://cases/${caseId}/${resourceName}${serialized.length > 0 ? `?${serialized}` : ''}`;
}

function headerSessionToken(request: FastifyRequest): string | null {
  const raw = request.headers['x-session-token'];
  if (Array.isArray(raw)) {
    return typeof raw[0] === 'string' && raw[0].length > 0 ? raw[0] : null;
  }
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function rejectMissingOrInvalidSession(
  request: FastifyRequest,
  reply: FastifyReply,
  sessionSecret: string
): boolean {
  const token = headerSessionToken(request);
  if (!token) {
    request.log.warn(
      { event: 'console_bff.read_session_token_missing', route: request.url },
      'console read request missing x-session-token'
    );
    reply.code(401);
    void reply.send({ message: 'x-session-token header is required' });
    return true;
  }

  try {
    resolveLocalSession(token, sessionSecret);
  } catch (error) {
    request.log.warn(
      {
        event: 'console_bff.read_session_token_invalid',
        route: request.url,
        detail: error instanceof Error ? error.message : 'unknown'
      },
      'console read request rejected: invalid session token'
    );
    reply.code(401);
    void reply.send({ message: 'invalid session token' });
    return true;
  }

  return false;
}

export async function registerResourceRoutes(
  app: FastifyInstance,
  options: { mcpClient: ConsoleMcpClient; sessionSecret: string }
) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/cases/')) {
      return;
    }

    // The collection endpoint /api/cases is registered in cases.ts and has its
    // own preHandler. Sub-resources under /api/cases/:caseId/* live here.
    const handled = rejectMissingOrInvalidSession(request, reply, options.sessionSecret);
    if (handled) {
      return reply;
    }
  });

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
