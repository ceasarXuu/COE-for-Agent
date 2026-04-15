import type { InvestigationServerServices } from '../../services.js';

import { handleGapResolve } from './gap-resolve.js';
import { handleInquiryClose } from './inquiry-close.js';
import { handleResidualUpdate } from './residual-update.js';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function handleIssueResolve(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const issueId = asString(input.issueId) ?? '';
  const resolution = asString(input.resolution) ?? 'resolved';
  const rationale = asString(input.rationale);

  if (issueId.startsWith('inquiry_')) {
    return handleInquiryClose(services, {
      ...input,
      inquiryId: issueId,
      resolutionKind: resolution === 'merged' ? 'merged' : 'answered',
      reason: rationale
    });
  }

  if (issueId.startsWith('gap_')) {
    return handleGapResolve(services, {
      ...input,
      gapId: issueId,
      status: resolution === 'accepted' ? 'waived' : 'resolved',
      reason: rationale
    });
  }

  if (issueId.startsWith('residual_')) {
    return handleResidualUpdate(services, {
      ...input,
      residualId: issueId,
      newStatus: resolution === 'accepted' ? 'accepted' : 'resolved',
      rationale
    });
  }

  throw new Error(`Unsupported issueId: ${issueId}`);
}
