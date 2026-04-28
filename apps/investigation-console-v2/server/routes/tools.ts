import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { handleConfirmIntentRequest } from '../auth/confirm.js';
import { resolveLocalSession } from '../auth/session.js';
import { isConsoleMcpToolName, type ConsoleMcpClient } from '../mcp-types.js';

interface SessionBundle {
  sessionToken: string;
  actorContext: {
    actorType: string;
    actorId: string;
    sessionId: string;
    role: string;
    issuer: string;
    authMode: string;
  };
  expiresAt: string;
}

function headerSessionToken(request: FastifyRequest): string | null {
  const rawHeader = request.headers['x-session-token'];
  if (Array.isArray(rawHeader)) {
    return rawHeader[0] ?? null;
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

function asPayload(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export async function registerToolRoutes(
  app: FastifyInstance,
  options: {
    mcpClient: ConsoleMcpClient;
    sessionSecret: string;
    getDefaultSession: () => SessionBundle;
  }
) {
  app.get('/api/session', async () => {
    const session = options.getDefaultSession();

    console.info('[investigation-console] session-issued', {
      event: 'session.issued',
      sessionId: session.actorContext.sessionId,
      expiresAt: session.expiresAt
    });

    return session;
  });

  app.post('/api/confirm-intent', async (request, reply) => {
    const sessionToken = requireSessionToken(request, reply);
    if (!sessionToken) {
      return { message: 'x-session-token header is required for console write requests' };
    }
    const body = asPayload(request.body);
    const commandName = typeof body.commandName === 'string' ? body.commandName.trim() : '';
    const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : '';
    const rationale = typeof body.rationale === 'string' ? body.rationale : '';
    const targetIds = Array.isArray(body.targetIds)
      ? body.targetIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];

    if (!commandName) {
      reply.code(400);
      return { message: 'commandName is required' };
    }
    if (!caseId) {
      reply.code(400);
      return { message: 'caseId is required' };
    }
    if (!rationale.trim()) {
      reply.code(400);
      return { message: 'rationale is required' };
    }

    return handleConfirmIntentRequest({
      sessionToken,
      secret: options.sessionSecret,
      body: {
        commandName,
        caseId,
        targetIds,
        rationale
      }
    });
  });

  app.post('/api/tools/:toolName', async (request, reply) => {
    const params = request.params as { toolName: string };
    const body = asPayload(request.body);
    if (!isConsoleMcpToolName(params.toolName)) {
      request.log.warn({
        event: 'console_bff.tool_name_rejected',
        toolName: params.toolName
      }, 'console tool request rejected unknown tool');
      reply.code(404);
      return { message: `Unknown investigation tool: ${params.toolName}` };
    }

    const sessionToken = requireSessionToken(request, reply);
    if (!sessionToken) {
      return { message: 'x-session-token header is required for console write requests' };
    }
    const isGuardrailTool = params.toolName.startsWith('investigation.guardrail.');
    const actorContext = resolveLocalSession(sessionToken, options.sessionSecret);

    const result = await options.mcpClient.invokeTool(params.toolName, {
      ...body,
      ...(isGuardrailTool ? {} : { actorContext })
    });

    return result;
  });
}
