export const MUTATION_TOOL_NAMES = [
  'investigation.case.open',
  'investigation.case.advance_stage',
  'investigation.problem.update',
  'investigation.problem.set_status',
  'investigation.problem.add_reference_material',
  'investigation.hypothesis.create',
  'investigation.hypothesis.set_status',
  'investigation.blocker.open',
  'investigation.blocker.close',
  'investigation.repair_attempt.create',
  'investigation.repair_attempt.set_status',
  'investigation.evidence.capture',
  'investigation.evidence.attach_existing',
  'investigation.evidence.capture_and_attach'
] as const;

export const GUARDRAIL_TOOL_NAMES = [
  'investigation.guardrail.check',
  'investigation.guardrail.stall_check',
  'investigation.guardrail.ready_to_patch_check',
  'investigation.guardrail.close_case_check'
] as const;

export type MutationToolName = typeof MUTATION_TOOL_NAMES[number];
export type GuardrailToolName = typeof GUARDRAIL_TOOL_NAMES[number];
