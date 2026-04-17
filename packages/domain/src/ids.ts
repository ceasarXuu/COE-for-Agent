import { randomBytes } from 'node:crypto';

type DomainPrefix =
  | 'case'
  | 'problem'
  | 'inquiry'
  | 'entity'
  | 'symptom'
  | 'artifact'
  | 'evidence'
  | 'evidence_ref'
  | 'fact'
  | 'hypothesis'
  | 'experiment'
  | 'blocker'
  | 'repair_attempt'
  | 'gap'
  | 'residual'
  | 'decision'
  | 'reference_material';

type DomainId<P extends DomainPrefix> = `${P}_${string}`;

export type CaseId = DomainId<'case'>;
export type ProblemId = DomainId<'problem'>;
export type InquiryId = DomainId<'inquiry'>;
export type EntityId = DomainId<'entity'>;
export type SymptomId = DomainId<'symptom'>;
export type ArtifactId = DomainId<'artifact'>;
export type EvidenceId = DomainId<'evidence'>;
export type EvidenceRefId = DomainId<'evidence_ref'>;
export type FactId = DomainId<'fact'>;
export type HypothesisId = DomainId<'hypothesis'>;
export type ExperimentId = DomainId<'experiment'>;
export type BlockerId = DomainId<'blocker'>;
export type RepairAttemptId = DomainId<'repair_attempt'>;
export type GapId = DomainId<'gap'>;
export type ResidualId = DomainId<'residual'>;
export type DecisionId = DomainId<'decision'>;
export type ReferenceMaterialId = DomainId<'reference_material'>;

function createDomainId<P extends DomainPrefix>(prefix: P): DomainId<P> {
  return `${prefix}_${randomBytes(13).toString('hex').toUpperCase()}` as DomainId<P>;
}

function isDomainId<P extends DomainPrefix>(value: string, prefix: P): value is DomainId<P> {
  return new RegExp(`^${prefix}_[0-9A-F]{26}$`).test(value);
}

export function createCaseId(): CaseId {
  return createDomainId('case');
}

export function createProblemId(): ProblemId {
  return createDomainId('problem');
}

export function createInquiryId(): InquiryId {
  return createDomainId('inquiry');
}

export function createEntityId(): EntityId {
  return createDomainId('entity');
}

export function createSymptomId(): SymptomId {
  return createDomainId('symptom');
}

export function createArtifactId(): ArtifactId {
  return createDomainId('artifact');
}

export function createEvidenceId(): EvidenceId {
  return createDomainId('evidence');
}

export function createEvidenceRefId(): EvidenceRefId {
  return createDomainId('evidence_ref');
}

export function createFactId(): FactId {
  return createDomainId('fact');
}

export function createHypothesisId(): HypothesisId {
  return createDomainId('hypothesis');
}

export function createExperimentId(): ExperimentId {
  return createDomainId('experiment');
}

export function createBlockerId(): BlockerId {
  return createDomainId('blocker');
}

export function createRepairAttemptId(): RepairAttemptId {
  return createDomainId('repair_attempt');
}

export function createGapId(): GapId {
  return createDomainId('gap');
}

export function createResidualId(): ResidualId {
  return createDomainId('residual');
}

export function createDecisionId(): DecisionId {
  return createDomainId('decision');
}

export function createReferenceMaterialId(): ReferenceMaterialId {
  return createDomainId('reference_material');
}

export function isCaseId(value: string): value is CaseId {
  return isDomainId(value, 'case');
}

export function isProblemId(value: string): value is ProblemId {
  return isDomainId(value, 'problem');
}

export function isFactId(value: string): value is FactId {
  return isDomainId(value, 'fact');
}
