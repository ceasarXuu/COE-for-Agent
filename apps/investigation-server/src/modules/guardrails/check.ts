import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringArray } from '../shared/record-helpers.js';
import { isCanonicalHypothesisRecord, loadCaseGuardrailContext, nodeStatus } from './shared.js';

export async function handleGuardrailCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId);
  const warnings: Array<{ code: string; message: string; nodeIds: string[] }> = [];
  const violations: Array<{ code: string; message: string; nodeIds: string[] }> = [];

  const unfalsifiableHypotheses = context.hypotheses
    .filter(isCanonicalHypothesisRecord)
    .filter((record) => stringArray(recordPayload(record).falsificationCriteria).length === 0);
  if (unfalsifiableHypotheses.length > 0) {
    violations.push({
      code: 'unfalsifiable_hypotheses',
      message: 'One or more hypotheses do not define falsification criteria.',
      nodeIds: unfalsifiableHypotheses.map((record) => record.id)
    });
  }

  const activeBlockers = context.blockers.filter((record) => nodeStatus(record, 'active') === 'active');
  if (activeBlockers.length > 0) {
    warnings.push({
      code: 'stale_blockers',
      message: 'Active blockers are still preventing the confirmed branch from progressing.',
      nodeIds: activeBlockers.map((record) => record.id)
    });
  }

  return {
    kind: 'investigation.guardrail.check_result',
    warnings,
    violations
  };
}
