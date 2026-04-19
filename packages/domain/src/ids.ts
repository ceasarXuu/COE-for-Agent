import { randomBytes } from 'node:crypto';

type DomainPrefix =
  | 'case'
  | 'problem'
  | 'evidence'
  | 'evidence_ref'
  | 'hypothesis'
  | 'blocker'
  | 'repair_attempt'
  | 'reference_material';

type DomainId<P extends DomainPrefix> = `${P}_${string}`;

export type CaseId = DomainId<'case'>;
export type ProblemId = DomainId<'problem'>;
export type EvidenceId = DomainId<'evidence'>;
export type EvidenceRefId = DomainId<'evidence_ref'>;
export type HypothesisId = DomainId<'hypothesis'>;
export type BlockerId = DomainId<'blocker'>;
export type RepairAttemptId = DomainId<'repair_attempt'>;
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

export function createEvidenceId(): EvidenceId {
  return createDomainId('evidence');
}

export function createEvidenceRefId(): EvidenceRefId {
  return createDomainId('evidence_ref');
}

export function createHypothesisId(): HypothesisId {
  return createDomainId('hypothesis');
}

export function createBlockerId(): BlockerId {
  return createDomainId('blocker');
}

export function createRepairAttemptId(): RepairAttemptId {
  return createDomainId('repair_attempt');
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
