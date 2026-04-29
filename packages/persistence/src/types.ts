import type { JsonValue } from './schema.js';

export interface StoredEvent {
  eventId: string;
  caseId: string;
  caseRevision: number;
  eventType: string;
  commandName: string;
  actor: JsonValue;
  payload: JsonValue;
  metadata: JsonValue;
  createdAt: Date;
}

export interface StoredCaseRecord {
  id: string;
  title: string | null;
  severity: string | null;
  status: string;
  revision: number;
  payload: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCurrentStateRecord {
  id: string;
  caseId: string;
  revision: number;
  status: string | null;
  payload: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredCaseListProjectionRecord {
  caseId: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  status: string | null;
  activeHypothesisCount: number;
  updatedAt: Date;
}

export interface StoredCheckpointRecord {
  caseId: string;
  revision: number;
  projectionState: JsonValue;
}

export interface StoredDedupRecord {
  eventId: string;
  commandResult: JsonValue;
  createdAt: Date;
}

export interface StoredOutboxRecord {
  outboxId: string;
  caseId: string;
  headRevision: number;
  eventId: string;
  taskType: string;
  status: string;
  attemptCount: number;
  availableAt: Date;
  claimedBy: string | null;
  claimedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PersistenceCurrentStateTableName =
  | 'problems'
  | 'blockers'
  | 'repair_attempts'
  | 'evidence_pool'
  | 'evidence_refs'
  | 'hypotheses';

export interface PersistenceStore {
  cases: Record<string, StoredCaseRecord>;
  eventsByCase: Record<string, StoredEvent[]>;
  currentState: Record<PersistenceCurrentStateTableName, Record<string, StoredCurrentStateRecord>>;
  caseListProjection: Record<string, StoredCaseListProjectionRecord>;
  checkpointsByCase: Record<string, Record<string, StoredCheckpointRecord>>;
  dedup: Record<string, StoredDedupRecord>;
  outbox: Record<string, StoredOutboxRecord>;
}

export interface CreatePersistenceClientOptions {
  dataDir?: string;
}
