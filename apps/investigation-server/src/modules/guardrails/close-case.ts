import type { InvestigationServerServices } from '../../services.js';
import { recordPayload } from '../shared/record-helpers.js';
import { loadCaseGuardrailContext, nodeStatus } from './shared.js';

export async function handleGuardrailCloseCaseCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId);

  const problem = context.problems[0] ?? null;
  const problemStatus = problem ? nodeStatus(problem, 'open') : 'open';
  const blockingBlockerIds = context.blockers
    .filter((record) => nodeStatus(record, 'active') === 'active')
    .map((record) => record.id);
  const effectiveRepairAttemptIds = context.repairAttempts
    .filter((record) => nodeStatus(record, 'proposed') === 'effective')
    .map((record) => record.id);
  const validatingEvidenceRefIds = context.evidenceRefs
    .filter((record) => {
      const payload = recordPayload(record);
      const parentNodeId = typeof payload.parentNodeId === 'string' ? payload.parentNodeId : '';
      const effectOnParent = typeof payload.effectOnParent === 'string' ? payload.effectOnParent : '';
      return effectiveRepairAttemptIds.includes(parentNodeId) && effectOnParent === 'validates';
    })
    .map((record) => record.id);
  const reasons: string[] = [];

  if (context.caseRecord.stage !== 'repair_validation' && context.caseRecord.stage !== 'closed') {
    reasons.push('Case must reach repair_validation before it can be closed.');
  }
  if (problemStatus !== 'resolved') {
    reasons.push('The canonical root problem must be resolved before case closure.');
  }
  if (blockingBlockerIds.length > 0) {
    reasons.push('Active canonical blockers must be closed before case closure.');
  }
  if (effectiveRepairAttemptIds.length === 0) {
    reasons.push('At least one effective repair attempt is required before case closure.');
  }
  if (validatingEvidenceRefIds.length === 0) {
    reasons.push('Explicit validation evidence is required before case closure.');
  }

  return {
    kind: 'investigation.guardrail.close_case_check_result',
    pass: reasons.length === 0,
    blockingInquiryIds: [],
    blockingResidualIds: [],
    blockingBlockerIds,
    blockingIssueIds: [...blockingBlockerIds].sort(),
    missingValidationRefs: validatingEvidenceRefIds.length === 0
      ? (effectiveRepairAttemptIds.length > 0 ? effectiveRepairAttemptIds : problem ? [problem.id] : [])
      : [],
    missingValidationIssueIds: validatingEvidenceRefIds.length === 0
      ? (effectiveRepairAttemptIds.length > 0 ? effectiveRepairAttemptIds : problem ? [problem.id] : [])
      : [],
    reasons
  };
}
