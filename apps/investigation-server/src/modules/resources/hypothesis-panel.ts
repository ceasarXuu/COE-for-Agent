import { createResourceEnvelope } from '@coe/domain';

import type { InvestigationServerServices } from '../../services.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getResourceSegments, parseRequestedRevision } from './shared.js';

function getCaseIdAndHypothesisId(url: URL): { caseId: string; hypothesisId: string } {
  const segments = getResourceSegments(url);
  return {
    caseId: segments[1] ?? '',
    hypothesisId: segments[3] ?? ''
  };
}

export async function readHypothesisPanelResource(services: InvestigationServerServices, url: URL) {
  const { caseId, hypothesisId } = getCaseIdAndHypothesisId(url);
  const requestedRevision = parseRequestedRevision(url);
  const projectionState = await loadProjectedCaseState(services, caseId, requestedRevision);
  const hypothesis = projectionState.tables.hypotheses.get(hypothesisId) ?? null;
  const facts = [...projectionState.tables.facts.values()];
  const experiments = [...projectionState.tables.experiments.values()];
  const gaps = [...projectionState.tables.gaps.values()];
  const residuals = [...projectionState.tables.residuals.values()];
  const hypothesisPayload = asObject(hypothesis?.payload);
  const supportingFactIdSet = new Set(asStringArray(hypothesisPayload.dependsOnFactIds));
  const explainedSymptomIdSet = new Set(asStringArray(hypothesisPayload.explainsSymptomIds));

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision: projectionState.headRevision,
      projectionRevision: projectionState.projectionRevision,
      requestedRevision,
      data: {
        hypothesis: hypothesis && hypothesis.caseId === caseId
          ? {
              ...hypothesisPayload,
              id: hypothesis.id,
              caseId: hypothesis.caseId,
              status: hypothesis.status
            }
          : null,
        supportingFacts: facts
          .filter((record) => supportingFactIdSet.has(record.id))
          .map((record) => ({
            ...record.payload,
            id: record.id,
            caseId: record.caseId,
            status: record.status
          })),
        contradictingFacts: facts
          .filter((record) => !supportingFactIdSet.has(record.id))
          .filter((record) => asString(record.payload.polarity) === 'negative')
          .filter((record) => asStringArray(record.payload.aboutRefs).some((ref) => explainedSymptomIdSet.has(ref)))
          .map((record) => ({
            ...record.payload,
            id: record.id,
            caseId: record.caseId,
            status: record.status
          })),
        linkedExperiments: experiments
          .filter((record) => asStringArray(record.payload.testsHypothesisIds).includes(hypothesisId))
          .map((record) => ({
            ...record.payload,
            id: record.id,
            caseId: record.caseId,
            status: record.status
          })),
        openGaps: gaps
          .filter((record) => {
            const status = record.status ?? asString(record.payload.status);
            if (status === 'resolved' || status === 'waived') {
              return false;
            }

            const blockedRefs = asStringArray(record.payload.blockedRefs);
            return blockedRefs.length === 0 || blockedRefs.includes(hypothesisId);
          })
          .map((record) => ({
            ...record.payload,
            id: record.id,
            caseId: record.caseId,
            status: record.status
          })),
        openResiduals: residuals
          .filter((record) => {
            const status = record.status ?? asString(record.payload.status);
            return status !== 'resolved' && status !== 'accepted';
          })
          .map((record) => ({
            ...record.payload,
            id: record.id,
            caseId: record.caseId,
            status: record.status
          }))
      }
    })
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
}