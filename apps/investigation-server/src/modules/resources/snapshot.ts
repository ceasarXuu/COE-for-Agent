import { createResourceEnvelope } from '@coe/domain';

import type { InvestigationServerServices } from '../../services.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getCaseIdFromUrl, parseRequestedRevision } from './shared.js';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function readSnapshotResource(services: InvestigationServerServices, url: URL) {
  const caseId = getCaseIdFromUrl(url);
  const requestedRevision = parseRequestedRevision(url);
  const projectionState = await loadProjectedCaseState(services, caseId, requestedRevision);
  const caseRecord = projectionState.caseRecord;
  const payload = asObject(caseRecord?.payload);

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision: projectionState.headRevision,
      projectionRevision: projectionState.projectionRevision,
      requestedRevision,
      data: {
        case: caseRecord
          ? {
              ...payload,
              id: caseRecord.id,
              title: caseRecord.title,
              severity: caseRecord.severity,
              status: caseRecord.status,
              revision: caseRecord.revision
            }
          : null,
        counts: {
          problems: projectionState.tables.problems.size,
          hypotheses: projectionState.tables.hypotheses.size,
          blockers: projectionState.tables.blockers.size,
          repairAttempts: projectionState.tables.repair_attempts.size,
          evidenceRefs: projectionState.tables.evidence_refs.size
        },
        warnings: []
      }
    })
  };
}
