import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringArray } from '../shared/record-helpers.js';
import {
  isCanonicalHypothesisRecord,
  isCritical,
  isGapBlocking,
  isResidualBlocking,
  loadCaseGuardrailContext,
  nodeStatus
} from './shared.js';

export async function handleGuardrailReadyToPatchCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId);

  if (context.mode === 'canonical') {
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

  const candidateHypotheses = context.hypotheses.filter((record) => {
    const status = nodeStatus(record, 'proposed');
    return status === 'favored' || status === 'confirmed';
  });
  const candidateHypothesisIds = candidateHypotheses.map((record) => record.id);

  const criticalSymptomIds = context.symptoms.filter(isCritical).map((record) => record.id);
  const coveredCriticalSymptoms = new Set(
    candidateHypotheses.flatMap((record) => stringArray(recordPayload(record).explainsSymptomIds))
  );
  const uncoveredCriticalSymptomIds = criticalSymptomIds.filter((id) => !coveredCriticalSymptoms.has(id));

  const blockingGapIds = context.gaps
    .filter((record) => isCritical(record) && isGapBlocking(record))
    .filter((record) => {
      const blockedRefs = stringArray(recordPayload(record).blockedRefs);
      return blockedRefs.length === 0 || blockedRefs.some((id) => candidateHypothesisIds.includes(id));
    })
    .map((record) => record.id);

  const blockingResidualIds = context.residuals
    .filter((record) => isCritical(record) && isResidualBlocking(record))
    .map((record) => record.id);

  const completedExperimentIds = context.experiments
    .filter((record) => nodeStatus(record, 'planned') === 'completed')
    .filter((record) => {
      const testsHypothesisIds = stringArray(recordPayload(record).testsHypothesisIds);
      return testsHypothesisIds.some((id) => candidateHypothesisIds.includes(id));
    })
    .map((record) => record.id);

  const factsById = new Map(context.facts.map((record) => [record.id, record]));
  const candidatePatchRefs = [...new Set(
    candidateHypotheses.flatMap((record) => {
      const dependsOnFactIds = stringArray(recordPayload(record).dependsOnFactIds);
      return dependsOnFactIds.flatMap((factId) => stringArray(recordPayload(factsById.get(factId)).aboutRefs))
        .filter((ref) => ref.startsWith('entity_'));
    })
  )];

  const reasons: string[] = [];
  if (candidateHypothesisIds.length === 0) {
    reasons.push('No favored or confirmed hypothesis is available yet.');
  }
  if (uncoveredCriticalSymptomIds.length > 0) {
    reasons.push('Critical symptoms are not fully covered by a candidate hypothesis.');
  }
  if (blockingGapIds.length > 0) {
    reasons.push('Critical gaps still block the candidate patch path.');
  }
  if (blockingResidualIds.length > 0) {
    reasons.push('Critical residual risk is still open.');
  }
  if (completedExperimentIds.length === 0) {
    reasons.push('No completed experiment supports the candidate patch yet.');
  }
  if (candidatePatchRefs.length === 0) {
    reasons.push('Patch target entity is not explicit from the current evidence graph.');
  }

  return {
    kind: 'investigation.guardrail.ready_to_patch_result',
    pass: reasons.length === 0,
    candidateHypothesisIds,
    candidatePatchRefs,
    blockingGapIds,
    blockingResidualIds,
    blockingIssueIds: [...blockingGapIds, ...blockingResidualIds].sort(),
    uncoveredCriticalSymptomIds,
    uncoveredCriticalIssueIds: [...uncoveredCriticalSymptomIds].sort(),
    incompleteExperimentIds: context.experiments
      .filter((record) => nodeStatus(record, 'planned') !== 'completed')
      .map((record) => record.id),
    reasons
  };
}
