import { CurrentStateRepository, EventStoreRepository, type CurrentStateNodeRecord, type StoredEvent } from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringArray, stringValue } from '../shared/record-helpers.js';

export interface CaseGuardrailContext {
  caseRecord: NonNullable<Awaited<ReturnType<CurrentStateRepository['getCase']>>>;
  problems: CurrentStateNodeRecord[];
  inquiries: CurrentStateNodeRecord[];
  symptoms: CurrentStateNodeRecord[];
  facts: CurrentStateNodeRecord[];
  hypotheses: CurrentStateNodeRecord[];
  experiments: CurrentStateNodeRecord[];
  gaps: CurrentStateNodeRecord[];
  residuals: CurrentStateNodeRecord[];
  decisions: CurrentStateNodeRecord[];
  blockers: CurrentStateNodeRecord[];
  repairAttempts: CurrentStateNodeRecord[];
  evidenceRefs: CurrentStateNodeRecord[];
  mode: 'canonical' | 'legacy';
  events: StoredEvent[];
}

export async function loadCaseGuardrailContext(
  services: InvestigationServerServices,
  caseId: string,
  options: { includeEvents?: boolean } = {}
): Promise<CaseGuardrailContext> {
  const currentState = new CurrentStateRepository(services.db);
  const caseRecord = await currentState.getCase(caseId);

  if (!caseRecord) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const [
    problems,
    inquiries,
    symptoms,
    facts,
    hypotheses,
    experiments,
    gaps,
    residuals,
    decisions,
    blockers,
    repairAttempts,
    evidenceRefs,
    events
  ] = await Promise.all([
    currentState.listRecordsByCase('problems', caseId),
    currentState.listRecordsByCase('inquiries', caseId),
    currentState.listRecordsByCase('symptoms', caseId),
    currentState.listRecordsByCase('facts', caseId),
    currentState.listRecordsByCase('hypotheses', caseId),
    currentState.listRecordsByCase('experiments', caseId),
    currentState.listRecordsByCase('gaps', caseId),
    currentState.listRecordsByCase('residuals', caseId),
    currentState.listRecordsByCase('decisions', caseId),
    currentState.listRecordsByCase('blockers', caseId),
    currentState.listRecordsByCase('repair_attempts', caseId),
    currentState.listRecordsByCase('evidence_refs', caseId),
    options.includeEvents ? new EventStoreRepository(services.db).listCaseEvents(caseId) : Promise.resolve([])
  ]);

  const canonicalHypotheses = hypotheses.filter(isCanonicalHypothesisRecord);
  const hasCanonicalOnlyNodes = blockers.length > 0 || repairAttempts.length > 0 || evidenceRefs.length > 0;
  const hasLegacyGraphNodes = symptoms.length > 0
    || facts.length > 0
    || experiments.length > 0
    || gaps.length > 0
    || residuals.length > 0
    || decisions.length > 0
    || hypotheses.some((record) => !isCanonicalHypothesisRecord(record));
  const hasCanonicalGraphRoot = problems.length > 0;

  return {
    caseRecord,
    problems,
    inquiries,
    symptoms,
    facts,
    hypotheses,
    experiments,
    gaps,
    residuals,
    decisions,
    blockers,
    repairAttempts,
    evidenceRefs,
    mode: hasCanonicalOnlyNodes || (hasCanonicalGraphRoot && !hasLegacyGraphNodes) ? 'canonical' : 'legacy',
    events
  };
}

export function isCanonicalHypothesisRecord(record: CurrentStateNodeRecord): boolean {
  return stringValue(recordPayload(record).canonicalKind) === 'hypothesis';
}

export function nodeStatus(record: CurrentStateNodeRecord, fallback: string): string {
  return stringValue(record.status) ?? stringValue(recordPayload(record).status) ?? fallback;
}

export function nodeSeverity(record: CurrentStateNodeRecord): string | undefined {
  return stringValue(recordPayload(record).severity);
}

export function nodeRefs(record: CurrentStateNodeRecord, field: string): string[] {
  return stringArray(recordPayload(record)[field]);
}

export function isGapBlocking(record: CurrentStateNodeRecord): boolean {
  const status = nodeStatus(record, 'open');
  return status !== 'resolved' && status !== 'waived';
}

export function isResidualBlocking(record: CurrentStateNodeRecord): boolean {
  const status = nodeStatus(record, 'open');
  return status !== 'resolved' && status !== 'accepted';
}

export function isInquiryOpen(record: CurrentStateNodeRecord): boolean {
  const status = nodeStatus(record, 'open');
  return status !== 'closed' && status !== 'merged';
}

export function isCritical(record: CurrentStateNodeRecord): boolean {
  const payload = recordPayload(record);
  return nodeSeverity(record) === 'critical' || stringValue(payload.priority) === 'critical';
}
