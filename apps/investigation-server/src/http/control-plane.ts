import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { CheckpointRepository, type CheckpointRecord, CurrentStateRepository } from '@coe/persistence';

import type { InvestigationServerConfig } from '../config.js';
import { hashConfirmationReason, verifyConfirmToken } from '../auth/confirm-token.js';
import { verifySessionToken } from '../auth/session-token.js';
import { buildEventExport } from '../modules/export/events.js';
import { buildProvExport } from '../modules/export/prov.js';
import { loadProjectedCaseState, serializeProjectedCaseState } from '../modules/projections/replay.js';
import type { InvestigationServerServices } from '../services.js';

const ADMIN_REBUILD_COMMAND = 'admin.rebuild_projection';
const ADMIN_REBUILD_REASON = 'rebuild-projection';

interface ExportRequestParams {
  caseId: string;
}

function headerSessionToken(request: FastifyRequest): string | null {
  const raw = request.headers['x-session-token'];
  if (Array.isArray(raw)) {
    return typeof raw[0] === 'string' && raw[0].length > 0 ? raw[0] : null;
  }
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function rejectMissingSession(reply: FastifyReply): unknown {
  reply.code(401);
  return { message: 'x-session-token header is required' };
}

function rejectInvalidSession(reply: FastifyReply, error: unknown): unknown {
  reply.code(401);
  return {
    message: 'invalid session token',
    detail: error instanceof Error ? error.message : 'unknown'
  };
}

function rejectInsufficientRole(reply: FastifyReply, required: string): unknown {
  reply.code(403);
  return { message: `forbidden: minimum role required is ${required}` };
}

export async function registerControlPlane(
  app: FastifyInstance,
  config: InvestigationServerConfig,
  services: InvestigationServerServices
): Promise<void> {
  app.get('/healthz', async () => ({ ok: true, service: 'investigation-server' }));
  app.get('/readyz', async () => ({ ok: true, transport: config.mcpTransport }));
  app.get('/version', async () => ({ version: config.version }));

  app.get('/cases/:caseId/export/prov', async (request, reply) => {
    const sessionResult = requireSession(request, reply, config.localIssuerSecret);
    if (sessionResult.kind !== 'ok') {
      return sessionResult.body;
    }

    const caseId = getCaseId(request.params);
    if (!caseId) {
      reply.code(400);
      return { message: 'caseId path parameter is required' };
    }

    const caseRecord = await new CurrentStateRepository(services.db).getCase(caseId);
    if (!caseRecord) {
      reply.code(404);
      return { message: `Case not found: ${caseId}` };
    }

    request.log?.info({
      event: 'control_plane.export_prov',
      caseId,
      actorId: sessionResult.actor.actorId,
      role: sessionResult.actor.role
    }, 'control plane: prov export served');

    return buildProvExport(services, caseId);
  });

  app.get('/cases/:caseId/export/events', async (request, reply) => {
    const sessionResult = requireSession(request, reply, config.localIssuerSecret);
    if (sessionResult.kind !== 'ok') {
      return sessionResult.body;
    }

    const caseId = getCaseId(request.params);
    if (!caseId) {
      reply.code(400);
      return { message: 'caseId path parameter is required' };
    }

    const caseRecord = await new CurrentStateRepository(services.db).getCase(caseId);
    if (!caseRecord) {
      reply.code(404);
      return { message: `Case not found: ${caseId}` };
    }

    request.log?.info({
      event: 'control_plane.export_events',
      caseId,
      actorId: sessionResult.actor.actorId,
      role: sessionResult.actor.role
    }, 'control plane: events export served');

    return buildEventExport(services, caseId);
  });

  app.post('/admin/rebuild-projection', async (request, reply) => {
    const sessionResult = requireSession(request, reply, config.localIssuerSecret);
    if (sessionResult.kind !== 'ok') {
      return sessionResult.body;
    }

    const actor = sessionResult.actor;
    if (actor.role !== 'Reviewer' && actor.role !== 'Admin') {
      return rejectInsufficientRole(reply, 'Reviewer');
    }
    if (actor.actorType === 'agent') {
      reply.code(403);
      return { message: 'admin endpoints require a human session' };
    }

    const payload = asPayload(request.body);
    const caseId = stringField(payload.caseId);

    if (!caseId) {
      reply.code(400);
      return { message: 'caseId is required' };
    }

    const confirmToken = stringField(payload.confirmToken);
    if (!confirmToken) {
      reply.code(400);
      return { message: 'confirmToken is required for admin operations' };
    }

    try {
      verifyConfirmToken(confirmToken, {
        secret: config.localIssuerSecret,
        expectedCommandName: ADMIN_REBUILD_COMMAND,
        expectedCaseId: caseId,
        expectedTargetIds: [caseId],
        expectedSessionId: actor.sessionId,
        expectedRole: actor.role,
        expectedReasonHash: hashConfirmationReason(ADMIN_REBUILD_REASON)
      });
    } catch (error) {
      reply.code(403);
      return {
        message: 'confirmToken validation failed',
        detail: error instanceof Error ? error.message : 'unknown'
      };
    }

    const caseRecord = await new CurrentStateRepository(services.db).getCase(caseId);
    if (!caseRecord) {
      reply.code(404);
      return { message: `Case not found: ${caseId}` };
    }

    const requestedRevision = parseOptionalInteger(payload.revision);
    const targetRevision = requestedRevision === null
      ? caseRecord.revision
      : Math.max(0, Math.min(requestedRevision, caseRecord.revision));
    const projectionState = await loadProjectedCaseState(
      services,
      caseId,
      requestedRevision === null ? null : targetRevision
    );

    await new CheckpointRepository(services.db).save({
      caseId,
      revision: targetRevision,
      projectionState: serializeProjectedCaseState(projectionState) as CheckpointRecord['projectionState']
    });

    request.log?.info({
      event: 'control_plane.admin_rebuild_projection',
      caseId,
      requestedRevision: targetRevision,
      actorId: actor.actorId,
      role: actor.role
    }, 'control plane: projection rebuild executed');

    return {
      ok: true,
      caseId,
      requestedRevision: targetRevision,
      projectionRevision: projectionState.projectionRevision,
      headRevision: projectionState.headRevision
    };
  });
}

type SessionResult =
  | { kind: 'ok'; actor: ReturnType<typeof verifySessionToken> }
  | { kind: 'error'; body: unknown };

function requireSession(request: FastifyRequest, reply: FastifyReply, secret: string): SessionResult {
  const token = headerSessionToken(request);
  if (!token) {
    return { kind: 'error', body: rejectMissingSession(reply) };
  }
  try {
    return { kind: 'ok', actor: verifySessionToken(token, secret) };
  } catch (error) {
    request.log?.warn({
      event: 'control_plane.session_token_invalid',
      route: request.url
    }, 'control plane rejected invalid session token');
    return { kind: 'error', body: rejectInvalidSession(reply, error) };
  }
}

function getCaseId(params: unknown): string {
  if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
    const caseId = (params as Partial<ExportRequestParams>).caseId;
    if (typeof caseId === 'string' && caseId.length > 0) {
      return caseId;
    }
  }

  return '';
}

function asPayload(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseOptionalInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }

  return value;
}