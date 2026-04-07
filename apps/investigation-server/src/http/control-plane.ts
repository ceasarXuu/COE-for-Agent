import type { FastifyInstance } from 'fastify';

import { CheckpointRepository, type CheckpointRecord, CurrentStateRepository } from '@coe/persistence';

import type { InvestigationServerConfig } from '../config.js';
import { buildEventExport } from '../modules/export/events.js';
import { buildProvExport } from '../modules/export/prov.js';
import { loadProjectedCaseState, serializeProjectedCaseState } from '../modules/projections/replay.js';
import type { InvestigationServerServices } from '../services.js';

export async function registerControlPlane(
  app: FastifyInstance,
  config: InvestigationServerConfig,
  services: InvestigationServerServices
): Promise<void> {
  app.get('/healthz', async () => ({ ok: true, service: 'investigation-server' }));
  app.get('/readyz', async () => ({ ok: true, transport: config.mcpTransport }));
  app.get('/version', async () => ({ version: config.version }));

  app.get('/cases/:caseId/export/prov', async (request, reply) => {
    const caseId = getCaseId(request.params);
    const caseRecord = await new CurrentStateRepository(services.db).getCase(caseId);

    if (!caseRecord) {
      reply.code(404);
      return { message: `Case not found: ${caseId}` };
    }

    return buildProvExport(services, caseId);
  });

  app.get('/cases/:caseId/export/events', async (request, reply) => {
    const caseId = getCaseId(request.params);
    const caseRecord = await new CurrentStateRepository(services.db).getCase(caseId);

    if (!caseRecord) {
      reply.code(404);
      return { message: `Case not found: ${caseId}` };
    }

    return buildEventExport(services, caseId);
  });

  app.post('/admin/rebuild-projection', async (request, reply) => {
    const payload = asPayload(request.body);
    const caseId = stringField(payload.caseId);

    if (!caseId) {
      reply.code(400);
      return { message: 'caseId is required' };
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

    return {
      ok: true,
      caseId,
      requestedRevision: targetRevision,
      projectionRevision: projectionState.projectionRevision,
      headRevision: projectionState.headRevision
    };
  });
}

function getCaseId(params: unknown): string {
  if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
    const caseId = (params as Record<string, unknown>).caseId;
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