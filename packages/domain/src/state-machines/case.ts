export type CaseStatus = 'active' | 'blocked' | 'ready_to_patch' | 'validating' | 'closed';
export type CaseStage =
  | 'intake'
  | 'scoping'
  | 'evidence_collection'
  | 'hypothesis_competition'
  | 'discriminative_testing'
  | 'repair_preparation'
  | 'repair_validation'
  | 'closed';

export interface CaseLifecycleState {
  status: CaseStatus;
  stage: CaseStage;
}

const CASE_STAGE_SEQUENCE: CaseStage[] = [
  'intake',
  'scoping',
  'evidence_collection',
  'hypothesis_competition',
  'discriminative_testing',
  'repair_preparation',
  'repair_validation',
  'closed'
];

function statusForStage(stage: CaseStage): CaseStatus {
  if (stage === 'closed') {
    return 'closed';
  }

  if (stage === 'repair_validation') {
    return 'validating';
  }

  if (stage === 'repair_preparation') {
    return 'ready_to_patch';
  }

  return 'active';
}

export function advanceCaseStage(current: CaseLifecycleState, nextStage: CaseStage): CaseLifecycleState {
  const currentIndex = CASE_STAGE_SEQUENCE.indexOf(current.stage);
  const nextIndex = CASE_STAGE_SEQUENCE.indexOf(nextStage);
  const isSequentialAdvance = nextIndex === currentIndex + 1;

  if (currentIndex === -1 || nextIndex === -1 || !isSequentialAdvance) {
    throw new Error(`Invalid case stage transition: ${current.stage} -> ${nextStage}`);
  }

  return {
    status: statusForStage(nextStage),
    stage: nextStage
  };
}