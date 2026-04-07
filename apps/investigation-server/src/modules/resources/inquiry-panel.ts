import { createResourceEnvelope } from '@coe/domain';

import type { InvestigationServerServices } from '../../services.js';
import { loadProjectedCaseState } from '../projections/replay.js';
import { getResourceSegments, parseRequestedRevision } from './shared.js';

function getCaseIdAndInquiryId(url: URL): { caseId: string; inquiryId: string } {
  const segments = getResourceSegments(url);
  return {
    caseId: segments[1] ?? '',
    inquiryId: segments[3] ?? ''
  };
}

export async function readInquiryPanelResource(services: InvestigationServerServices, url: URL) {
  const { caseId, inquiryId } = getCaseIdAndInquiryId(url);
  const requestedRevision = parseRequestedRevision(url);
  const projectionState = await loadProjectedCaseState(services, caseId, requestedRevision);
  const inquiry = projectionState.tables.inquiries.get(inquiryId) ?? null;
  const payload = asObject(inquiry?.payload);
  const hypotheses = [...projectionState.tables.hypotheses.values()]
    .filter((record) => asString(record.payload.inquiryId) === inquiryId)
    .map((record) => ({
      ...record.payload,
      id: record.id,
      caseId: record.caseId,
      status: record.status
    }));
  const experiments = [...projectionState.tables.experiments.values()]
    .filter((record) => asString(record.payload.inquiryId) === inquiryId)
    .map((record) => ({
      ...record.payload,
      id: record.id,
      caseId: record.caseId,
      status: record.status
    }));
  const gaps = [...projectionState.tables.gaps.values()]
    .filter((record) => {
      const blockedRefs = asStringArray(record.payload.blockedRefs);
      return blockedRefs.length === 0 || hypotheses.some((hypothesis) => blockedRefs.includes(String(hypothesis.id ?? '')));
    })
    .map((record) => ({
      ...record.payload,
      id: record.id,
      caseId: record.caseId,
      status: record.status
    }));

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision: projectionState.headRevision,
      projectionRevision: projectionState.projectionRevision,
      requestedRevision,
      data: {
        inquiry: inquiry
          ? {
              ...payload,
              id: inquiry.id,
              caseId: inquiry.caseId,
              status: inquiry.status
            }
          : null,
        hypotheses,
        experiments,
        gaps
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