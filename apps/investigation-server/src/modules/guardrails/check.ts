import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringArray } from '../shared/record-helpers.js';
import { loadCaseGuardrailContext, nodeStatus } from './shared.js';

export async function handleGuardrailCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId);
  const warnings: Array<{ code: string; message: string; nodeIds: string[] }> = [];
  const violations: Array<{ code: string; message: string; nodeIds: string[] }> = [];

  const unfalsifiableHypotheses = context.hypotheses.filter((record) => stringArray(recordPayload(record).falsificationCriteria).length === 0);
  if (unfalsifiableHypotheses.length > 0) {
    violations.push({
      code: 'unfalsifiable_hypotheses',
      message: 'One or more hypotheses do not define falsification criteria.',
      nodeIds: unfalsifiableHypotheses.map((record) => record.id)
    });
  }

  const uncitedDecisions = context.decisions.filter((record) => {
    const payload = recordPayload(record);
    return stringArray(payload.supportingFactIds).length === 0 && stringArray(payload.supportingExperimentIds).length === 0;
  });
  if (uncitedDecisions.length > 0) {
    violations.push({
      code: 'uncited_decisions',
      message: 'One or more decisions do not cite supporting facts or experiments.',
      nodeIds: uncitedDecisions.map((record) => record.id)
    });
  }

  const staleGaps = context.gaps.filter((record) => {
    const status = nodeStatus(record, 'open');
    return status === 'open' || status === 'in_progress' || status === 'blocked';
  });
  if (staleGaps.length > 0) {
    warnings.push({
      code: 'stale_gaps',
      message: 'Open gaps are still blocking investigation progress.',
      nodeIds: staleGaps.map((record) => record.id)
    });
  }

  const inquiryToHypothesisCount = new Map<string, number>();
  for (const hypothesis of context.hypotheses) {
    const payload = recordPayload(hypothesis);
    const inquiryId = typeof payload.inquiryId === 'string' ? payload.inquiryId : null;
    const status = nodeStatus(hypothesis, 'proposed');
    if (!inquiryId || status === 'rejected') {
      continue;
    }

    inquiryToHypothesisCount.set(inquiryId, (inquiryToHypothesisCount.get(inquiryId) ?? 0) + 1);
  }

  const crowdedInquiries = [...inquiryToHypothesisCount.entries()]
    .filter(([, count]) => count > 3)
    .map(([inquiryId]) => inquiryId);
  if (crowdedInquiries.length > 0) {
    warnings.push({
      code: 'excessive_active_hypotheses_per_inquiry',
      message: 'At least one inquiry has more than three active hypotheses competing at once.',
      nodeIds: crowdedInquiries
    });
  }

  return {
    kind: 'investigation.guardrail.check_result',
    warnings,
    violations
  };
}