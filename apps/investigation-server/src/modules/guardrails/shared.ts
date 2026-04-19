import { CurrentStateRepository, EventStoreRepository, type CurrentStateNodeRecord, type StoredEvent } from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringValue } from '../shared/record-helpers.js';

export interface CaseGuardrailContext {
  caseRecord: NonNullable<Awaited<ReturnType<CurrentStateRepository['getCase']>>>;
  problems: CurrentStateNodeRecord[];
  hypotheses: CurrentStateNodeRecord[];
  blockers: CurrentStateNodeRecord[];
  repairAttempts: CurrentStateNodeRecord[];
  evidencePool: CurrentStateNodeRecord[];
  evidenceRefs: CurrentStateNodeRecord[];
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
    hypotheses,
    blockers,
    repairAttempts,
    evidencePool,
    evidenceRefs,
    events
  ] = await Promise.all([
    currentState.listRecordsByCase('problems', caseId),
    currentState.listRecordsByCase('hypotheses', caseId),
    currentState.listRecordsByCase('blockers', caseId),
    currentState.listRecordsByCase('repair_attempts', caseId),
    currentState.listRecordsByCase('evidence_pool', caseId),
    currentState.listRecordsByCase('evidence_refs', caseId),
    options.includeEvents ? new EventStoreRepository(services.db).listCaseEvents(caseId) : Promise.resolve([])
  ]);

  return {
    caseRecord,
    problems,
    hypotheses,
    blockers,
    repairAttempts,
    evidencePool,
    evidenceRefs,
    events
  };
}

export function isCanonicalHypothesisRecord(record: CurrentStateNodeRecord): boolean {
  return stringValue(recordPayload(record).canonicalKind) === 'hypothesis';
}

export function nodeStatus(record: CurrentStateNodeRecord, fallback: string): string {
  return stringValue(record.status) ?? stringValue(recordPayload(record).status) ?? fallback;
}
