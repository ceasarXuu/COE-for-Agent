import { createResourceEnvelope } from '@coe/domain';

import { investigationTelemetry } from '../../telemetry.js';
import type { InvestigationServerServices } from '../../services.js';
import { buildGraphSlice } from '../projections/graph-slice.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getCaseIdFromUrl, parseRequestedRevision } from './shared.js';

function parseDepth(url: URL): number {
  const value = Number(url.searchParams.get('depth') ?? '1');
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export async function readGraphResource(services: InvestigationServerServices, url: URL) {
  const caseId = getCaseIdFromUrl(url);
  const requestedRevision = parseRequestedRevision(url);
  const projectionState = await loadProjectedCaseState(services, caseId, requestedRevision);
  const data = buildGraphSlice(projectionState, {
    focusId: url.searchParams.get('focusId'),
    depth: parseDepth(url)
  });

  investigationTelemetry.emitCaseProjectionUpdated({
    caseId,
    projection: 'graph',
    headRevision: projectionState.headRevision,
    projectionRevision: projectionState.projectionRevision
  });

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision: projectionState.headRevision,
      projectionRevision: projectionState.projectionRevision,
      requestedRevision,
      data
    })
  };
}