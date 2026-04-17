import { createResourceEnvelope } from '@coe/domain';

import type { InvestigationServerServices } from '../../services.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getCaseIdFromUrl, parseRequestedRevision } from './shared.js';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function readEvidencePoolResource(services: InvestigationServerServices, url: URL) {
  const caseId = getCaseIdFromUrl(url);
  const requestedRevision = parseRequestedRevision(url);
  const projectionState = await loadProjectedCaseState(services, caseId, requestedRevision);

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision: projectionState.headRevision,
      projectionRevision: projectionState.projectionRevision,
      requestedRevision,
      data: {
        items: [...projectionState.tables.evidence_pool.values()]
          .map((record) => {
            const payload = asObject(record.payload);
            return {
              evidenceId: record.id,
              kind: asString(payload.kind) ?? 'other',
              title: asString(payload.title) ?? record.id,
              summary: asString(payload.summary) ?? null,
              provenance: asString(payload.provenance) ?? null,
              confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
              revision: record.revision
            };
          })
          .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId))
      }
    })
  };
}
