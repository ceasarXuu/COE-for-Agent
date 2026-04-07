import { createResourceEnvelope } from '@coe/domain';
import { CurrentStateRepository } from '@coe/persistence';

import { investigationTelemetry } from '../../telemetry.js';
import type { InvestigationServerServices } from '../../services.js';
import { buildDiffProjection } from '../projections/diff.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getCaseIdFromUrl } from './shared.js';

function parseRevision(url: URL, name: string): number {
  const value = Number(url.searchParams.get(name) ?? '0');
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export async function readDiffResource(services: InvestigationServerServices, url: URL) {
  const caseId = getCaseIdFromUrl(url);
  const fromRevision = parseRevision(url, 'fromRevision');
  const toRevision = parseRevision(url, 'toRevision');
  const currentState = new CurrentStateRepository(services.db);
  const caseRecord = await currentState.getCase(caseId);
  const headRevision = caseRecord?.revision ?? 0;
  const fromState = await loadProjectedCaseState(services, caseId, fromRevision);
  const toState = await loadProjectedCaseState(services, caseId, toRevision);
  const diff = buildDiffProjection(fromState, toState);

  investigationTelemetry.emitCaseProjectionUpdated({
    caseId,
    projection: 'diff',
    headRevision,
    projectionRevision: toState.projectionRevision
  });

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision,
      projectionRevision: toState.projectionRevision,
      requestedRevision: toRevision < headRevision ? toRevision : null,
      data: diff
    })
  };
}