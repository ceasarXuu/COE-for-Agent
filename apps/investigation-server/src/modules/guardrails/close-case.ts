import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringArray, stringValue } from '../shared/record-helpers.js';
import { isInquiryOpen, isResidualBlocking, loadCaseGuardrailContext, nodeStatus } from './shared.js';

export async function handleGuardrailCloseCaseCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId);

  if (context.mode === 'canonical') {
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
        const parentNodeId = stringValue(payload.parentNodeId) ?? '';
        const effectOnParent = stringValue(payload.effectOnParent) ?? '';
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

  const blockingInquiryIds = context.inquiries.filter(isInquiryOpen).map((record) => record.id);
  const blockingResidualIds = context.residuals.filter(isResidualBlocking).map((record) => record.id);
  const criticalSymptoms = context.symptoms.filter((record) => {
    const payload = recordPayload(record);
    return stringValue(payload.severity) === 'critical' || stringValue(payload.priority) === 'critical';
  });
  const validationFactIds = context.facts
    .filter((record) => {
      const payload = recordPayload(record);
      const factKind = stringValue(payload.factKind) ?? '';
      return factKind.includes('validation') || factKind.includes('verification');
    })
    .map((record) => record.id);
  const validationExperimentIds = context.experiments
    .filter((record) => record.status === 'completed' || stringValue(recordPayload(record).status) === 'completed')
    .filter((record) => {
      const method = stringValue(recordPayload(record).method) ?? '';
      return method === 'patch_probe';
    })
    .map((record) => record.id);
  const hypothesesById = new Map(context.hypotheses.map((record) => [record.id, record]));
  const validatedSymptomIds = new Set(
    context.facts
      .filter((record) => validationFactIds.includes(record.id))
      .flatMap((record) => stringArray(recordPayload(record).aboutRefs))
      .concat(
        context.experiments
          .filter((record) => validationExperimentIds.includes(record.id))
          .flatMap((record) => stringArray(recordPayload(record).testsHypothesisIds))
          .flatMap((hypothesisId) => stringArray(recordPayload(hypothesesById.get(hypothesisId)).explainsSymptomIds))
      )
  );
  const missingValidationRefs = criticalSymptoms
    .map((record) => record.id)
    .filter((id) => !validatedSymptomIds.has(id));
  const reasons: string[] = [];

  if (context.caseRecord.stage !== 'repair_validation' && context.caseRecord.stage !== 'closed') {
    reasons.push('Case must reach repair_validation before it can be closed.');
  }
  if (blockingInquiryIds.length > 0) {
    reasons.push('All inquiries must be closed or merged before case closure.');
  }
  if (blockingResidualIds.length > 0) {
    reasons.push('Residual risk must be resolved or accepted before case closure.');
  }
  if (validationFactIds.length === 0 && validationExperimentIds.length === 0) {
    reasons.push('At least one validation fact or validation experiment is required before case closure.');
  }
  if (missingValidationRefs.length > 0) {
    reasons.push('Critical symptoms still lack explicit validation evidence.');
  }

  return {
    kind: 'investigation.guardrail.close_case_check_result',
    pass: reasons.length === 0,
    blockingInquiryIds,
    blockingResidualIds,
    blockingIssueIds: [...blockingInquiryIds, ...blockingResidualIds].sort(),
    missingValidationRefs,
    missingValidationIssueIds: [...missingValidationRefs].sort(),
    reasons
  };
}
