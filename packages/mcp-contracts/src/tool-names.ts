export const MUTATION_TOOL_NAMES = [
  'investigation.case.open',
  'investigation.case.advance_stage',
  'investigation.inquiry.open',
  'investigation.inquiry.close',
  'investigation.entity.register',
  'investigation.symptom.report',
  'investigation.artifact.attach',
  'investigation.fact.assert',
  'investigation.hypothesis.propose',
  'investigation.hypothesis.update_status',
  'investigation.experiment.plan',
  'investigation.experiment.record_result',
  'investigation.gap.open',
  'investigation.gap.resolve',
  'investigation.residual.open',
  'investigation.residual.update',
  'investigation.decision.record'
] as const;

export const GUARDRAIL_TOOL_NAMES = [
  'investigation.guardrail.check',
  'investigation.guardrail.stall_check',
  'investigation.guardrail.ready_to_patch_check',
  'investigation.guardrail.close_case_check'
] as const;

export type MutationToolName = typeof MUTATION_TOOL_NAMES[number];
export type GuardrailToolName = typeof GUARDRAIL_TOOL_NAMES[number];