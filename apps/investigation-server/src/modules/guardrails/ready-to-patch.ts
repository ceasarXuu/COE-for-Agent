import type { InvestigationServerServices } from '../../services.js';
import { recordPayload } from '../shared/record-helpers.js';
import { isCanonicalHypothesisRecord, loadCaseGuardrailContext, nodeStatus } from './shared.js';

export async function handleGuardrailReadyToPatchCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId);

  const candidateHypotheses = context.hypotheses
    .filter(isCanonicalHypothesisRecord)
    .filter((record) => nodeStatus(record, 'unverified') === 'confirmed');
  const candidateHypothesisIds = candidateHypotheses.map((record) => record.id);
  const blockingBlockerIds = context.blockers
    .filter((record) => nodeStatus(record, 'active') === 'active')
    .filter((record) => {
      const parentNodeId = typeof recordPayload(record).parentNodeId === 'string'
        ? String(recordPayload(record).parentNodeId)
        : null;
      return parentNodeId !== null && candidateHypothesisIds.includes(parentNodeId);
    })
    .map((record) => record.id);
  const reasons: string[] = [];

  if (candidateHypothesisIds.length === 0) {
    reasons.push('No confirmed hypothesis is available yet.');
  }
  if (blockingBlockerIds.length > 0) {
    reasons.push('Active canonical blockers still block the candidate patch path.');
  }

  return {
    kind: 'investigation.guardrail.ready_to_patch_result',
    pass: reasons.length === 0,
    candidateHypothesisIds,
    candidatePatchRefs: [],
    blockingGapIds: [],
    blockingResidualIds: [],
    blockingBlockerIds,
    blockingIssueIds: [...blockingBlockerIds].sort(),
    uncoveredCriticalSymptomIds: [],
    uncoveredCriticalIssueIds: [],
    incompleteExperimentIds: [],
    reasons
  };
}
