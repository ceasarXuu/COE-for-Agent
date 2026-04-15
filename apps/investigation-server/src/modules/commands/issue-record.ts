import type { InvestigationServerServices } from '../../services.js';

import { handleGapOpen } from './gap-open.js';
import { handleInquiryOpen } from './inquiry-open.js';
import { handleResidualOpen } from './residual-open.js';
import { handleSymptomReport } from './symptom-report.js';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
}

export async function handleIssueRecord(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const issueKind = asString(input.issueKind);
  const title = asString(input.title);
  const summary = asString(input.summary);
  const priority = asString(input.priority) ?? 'medium';
  const blocking = input.blocking === true;

  switch (issueKind) {
    case 'question':
      return handleInquiryOpen(services, {
        ...input,
        title: title ?? summary ?? 'Untitled issue',
        question: summary ?? title ?? 'Untitled issue',
        priority,
        scopeRefs: asStringArray(input.scopeRefs)
      });
    case 'symptom':
      return handleSymptomReport(services, {
        ...input,
        statement: summary ?? title ?? 'Untitled issue',
        severity: priority,
        reproducibility: asString(input.reproducibility) ?? 'unknown'
      });
    case 'unresolved':
      if (blocking) {
        return handleGapOpen(services, {
          ...input,
          question: summary ?? title ?? 'Untitled issue',
          priority,
          blockedRefs: asStringArray(input.blockedRefs)
        });
      }

      return handleResidualOpen(services, {
        ...input,
        statement: summary ?? title ?? 'Untitled issue',
        severity: priority,
        relatedSymptomIds: asStringArray(input.relatedSymptomIds)
      });
    default:
      throw new Error(`Unsupported issueKind: ${issueKind ?? 'unknown'}`);
  }
}
