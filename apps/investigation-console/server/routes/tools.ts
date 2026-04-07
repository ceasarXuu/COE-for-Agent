import type { FastifyInstance, FastifyRequest } from 'fastify';

import { handleConfirmIntentRequest } from '../auth/confirm.js';
import { resolveLocalSession } from '../auth/session.js';
import type { ConsoleMcpClient } from '../mcp-types.js';

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
    defaultSession: SessionBundle;
  }
) {
  app.get('/api/session', async () => options.defaultSession);

  app.post('/api/confirm-intent', async (request) => {
    const sessionToken = headerSessionToken(request) ?? options.defaultSession.sessionToken;
    const body = asPayload(request.body);

    return handleConfirmIntentRequest({
      sessionToken,
      secret: options.sessionSecret,
      body: {
        commandName: String(body.commandName ?? ''),
        caseId: String(body.caseId ?? ''),
        targetIds: Array.isArray(body.targetIds) ? body.targetIds.filter((value): value is string => typeof value === 'string') : [],
        rationale: String(body.rationale ?? '')
      }
    });
  });

  app.post('/api/tools/:toolName', async (request) => {
    const params = request.params as { toolName: string };
    const body = asPayload(request.body);
    const isGuardrailTool = params.toolName.startsWith('investigation.guardrail.');
    const sessionToken = headerSessionToken(request) ?? options.defaultSession.sessionToken;
    const actorContext = isGuardrailTool ? null : resolveLocalSession(sessionToken, options.sessionSecret);

    const result = await options.mcpClient.invokeTool(params.toolName, {
      ...body,
      ...(actorContext ? { actorContext } : {})
    });

    return result;
  });
}