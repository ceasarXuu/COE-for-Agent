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
              stage: caseRecord.stage,
              revision: caseRecord.revision
            }
          : null,
        counts: {
          inquiries: projectionState.tables.inquiries.size,
          symptoms: projectionState.tables.symptoms.size,
          artifacts: projectionState.tables.artifacts.size,
          facts: projectionState.tables.facts.size
        },
        warnings: []
      }
    })
  };
}