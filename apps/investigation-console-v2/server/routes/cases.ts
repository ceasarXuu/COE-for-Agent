import { randomUUID } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { resolveLocalSession } from '../auth/session.js';
import type { ConsoleMcpClient } from '../mcp-types.js';

interface ManualCaseCreateInput {
  title?: unknown;
  objective?: unknown;
  severity?: unknown;
  projectDirectory?: unknown;
  labels?: unknown;
  idempotencyKey?: unknown;
}

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

function headerSessionToken(request: FastifyRequest): string | null {
  const rawHeader = request.headers['x-session-token'];
  if (Array.isArray(rawHeader)) {
    return typeof rawHeader[0] === 'string' ? rawHeader[0] : null;
  }

  return typeof rawHeader === 'string' ? rawHeader : null;
}

function requireSessionToken(request: FastifyRequest, reply: FastifyReply): string | null {
  const sessionToken = headerSessionToken(request);
  if (sessionToken) {
    return sessionToken;
  }

  request.log.warn({
    event: 'console_bff.session_token_missing',
    route: request.url
  }, 'console write request missing x-session-token');
  reply.code(401);
  return null;
}

function asPayload(body: unknown): ManualCaseCreateInput {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as ManualCaseCreateInput)
    : {};
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function optionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function findCreatedId(createdIds: unknown, prefix: string): string | null {
  if (!Array.isArray(createdIds)) {
    return null;
  }

  return createdIds.find((value): value is string => typeof value === 'string' && value.startsWith(prefix)) ?? null;
}

export async function registerCasesRoutes(
  app: FastifyInstance,
  options: {
    mcpClient: ConsoleMcpClient;
    sessionSecret: string;
  }
) {
  app.get('/api/cases', async (request, reply) => {
    const sessionToken = requireSessionToken(request, reply);
    if (!sessionToken) {
      return { message: 'x-session-token header is required for console read requests' };
    }

    try {
      resolveLocalSession(sessionToken, options.sessionSecret);
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
      return { message: 'invalid session token' };
    }

    const query = typeof request.query === 'object' && request.query !== null
      ? (request.query as Record<string, unknown>)
      : {};
    const resource = await options.mcpClient.readResource(`investigation://cases${buildQueryString(query)}`);

    return resource.data;
  });

  app.post('/api/cases', async (request, reply) => {
    const body = asPayload(request.body);
    const title = requireString(body.title, 'title');
    const objective = requireString(body.objective, 'objective');
    const severity = requireString(body.severity, 'severity');
    const projectDirectory = requireString(body.projectDirectory, 'projectDirectory');
    const labels = optionalStringArray(body.labels);
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : `console-case-open-${randomUUID()}`;
    const sessionToken = requireSessionToken(request, reply);
    if (!sessionToken) {
      return { message: 'x-session-token header is required for console write requests' };
    }
    const actorContext = resolveLocalSession(sessionToken, options.sessionSecret);

    request.log.info({
      event: 'manual_case_create.requested',
      severity,
      projectDirectory,
      labelCount: labels.length
    }, 'manual case create requested');

    const result = await options.mcpClient.invokeTool('investigation.case.open', {
      idempotencyKey,
      title,
      objective,
      severity,
      projectDirectory,
      labels,
      actorContext
    }) as Record<string, unknown>;

    const caseId = findCreatedId(result.createdIds, 'case_');
    const problemId = findCreatedId(result.createdIds, 'problem_');

    request.log.info({
      event: 'manual_case_create.completed',
      caseId,
      problemId,
      headRevisionAfter: result.headRevisionAfter ?? null
    }, 'manual case create completed');

    return {
      ...result,
      caseId,
      problemId
    };
  });
}
