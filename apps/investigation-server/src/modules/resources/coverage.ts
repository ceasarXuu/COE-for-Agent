import { createResourceEnvelope } from '@coe/domain';

import { investigationTelemetry } from '../../telemetry.js';
import type { InvestigationServerServices } from '../../services.js';
import { buildCoverageProjection } from '../projections/coverage.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getCaseIdFromUrl, parseRequestedRevision } from './shared.js';

export async function readCoverageResource(services: InvestigationServerServices, url: URL) {
  const caseId = getCaseIdFromUrl(url);
  const requestedRevision = parseRequestedRevision(url);
  const projectionState = await loadProjectedCaseState(services, caseId, requestedRevision);
  const data = buildCoverageProjection(projectionState);

  investigationTelemetry.emitCaseProjectionUpdated({
    caseId,
    projection: 'coverage',
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