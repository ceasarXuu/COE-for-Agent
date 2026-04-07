import { randomBytes } from 'node:crypto';

type DomainPrefix =
  | 'case'
  | 'inquiry'
  | 'entity'
  | 'symptom'
  | 'artifact'
  | 'fact'
  | 'hypothesis'
  | 'experiment'
  | 'gap'
  | 'residual'
  | 'decision';

type DomainId<P extends DomainPrefix> = `${P}_${string}`;

export type CaseId = DomainId<'case'>;
export type InquiryId = DomainId<'inquiry'>;
export type EntityId = DomainId<'entity'>;
export type SymptomId = DomainId<'symptom'>;
export type ArtifactId = DomainId<'artifact'>;
export type FactId = DomainId<'fact'>;
export type HypothesisId = DomainId<'hypothesis'>;
export type ExperimentId = DomainId<'experiment'>;
export type GapId = DomainId<'gap'>;
export type ResidualId = DomainId<'residual'>;
export type DecisionId = DomainId<'decision'>;

function createDomainId<P extends DomainPrefix>(prefix: P): DomainId<P> {
  return `${prefix}_${randomBytes(13).toString('hex').toUpperCase()}` as DomainId<P>;
}

function isDomainId<P extends DomainPrefix>(value: string, prefix: P): value is DomainId<P> {
  return new RegExp(`^${prefix}_[0-9A-F]{26}$`).test(value);
}

export function createCaseId(): CaseId {
  return createDomainId('case');
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

export function createFactId(): FactId {
  return createDomainId('fact');
}

export function createHypothesisId(): HypothesisId {
  return createDomainId('hypothesis');
}

export function createExperimentId(): ExperimentId {
  return createDomainId('experiment');
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

export function isCaseId(value: string): value is CaseId {
  return isDomainId(value, 'case');
}

export function isFactId(value: string): value is FactId {
  return isDomainId(value, 'fact');
}