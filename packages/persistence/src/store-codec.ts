import type { JsonValue } from './schema.js';
import type {
  PersistenceCurrentStateTableName,
  PersistenceStore,
  StoredCaseListProjectionRecord,
  StoredCaseRecord,
  StoredCheckpointRecord,
  StoredCurrentStateRecord,
  StoredDedupRecord,
  StoredEvent,
  StoredOutboxRecord
} from './types.js';

export function createEmptyStore(): PersistenceStore {
  return {
    cases: {},
    eventsByCase: {},
    currentState: {
      problems: {},
      blockers: {},
      repair_attempts: {},
      evidence_pool: {},
      evidence_refs: {},
      hypotheses: {}
    },
    caseListProjection: {},
    checkpointsByCase: {},
    dedup: {},
    outbox: {}
  };
}

export function serializeStore(store: PersistenceStore): string {
  return JSON.stringify(store, null, 2);
}

function reviveDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function reviveStoredEvent(event: Record<string, unknown>): StoredEvent {
  return {
    eventId: String(event.eventId),
    caseId: String(event.caseId),
    caseRevision: Number(event.caseRevision),
    eventType: String(event.eventType),
    commandName: String(event.commandName),
    actor: (event.actor ?? {}) as JsonValue,
    payload: (event.payload ?? {}) as JsonValue,
    metadata: (event.metadata ?? {}) as JsonValue,
    createdAt: reviveDate(event.createdAt)
  };
}

function reviveCurrentStateRecord(record: Record<string, unknown>): StoredCurrentStateRecord {
  return {
    id: String(record.id),
    caseId: String(record.caseId),
    revision: Number(record.revision),
    status: record.status === null || record.status === undefined ? null : String(record.status),
    payload: (record.payload ?? {}) as JsonValue,
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveCaseRecord(record: Record<string, unknown>): StoredCaseRecord {
  return {
    id: String(record.id),
    title: record.title === null || record.title === undefined ? null : String(record.title),
    severity: record.severity === null || record.severity === undefined ? null : String(record.severity),
    status: String(record.status),
    revision: Number(record.revision),
    payload: (record.payload ?? {}) as JsonValue,
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveCaseListProjectionRecord(record: Record<string, unknown>): StoredCaseListProjectionRecord {
  return {
    caseId: String(record.caseId),
    title: record.title === null || record.title === undefined ? null : String(record.title),
    summary: record.summary === null || record.summary === undefined ? null : String(record.summary),
    severity: record.severity === null || record.severity === undefined ? null : String(record.severity),
    status: record.status === null || record.status === undefined ? null : String(record.status),
    activeHypothesisCount: Number(record.activeHypothesisCount ?? 0),
    updatedAt: reviveDate(record.updatedAt)
  };
}

function reviveCheckpointRecord(record: Record<string, unknown>): StoredCheckpointRecord {
  return {
    caseId: String(record.caseId),
    revision: Number(record.revision),
    projectionState: (record.projectionState ?? {}) as JsonValue
  };
}

function reviveDedupRecord(record: Record<string, unknown>): StoredDedupRecord {
  return {
    eventId: String(record.eventId),
    commandResult: (record.commandResult ?? {}) as JsonValue,
    createdAt: reviveDate(record.createdAt)
  };
}

function reviveOutboxRecord(record: Record<string, unknown>): StoredOutboxRecord {
  return {
    outboxId: String(record.outboxId),
    caseId: String(record.caseId),
    headRevision: Number(record.headRevision),
    eventId: String(record.eventId),
    taskType: String(record.taskType),
    status: String(record.status),
    attemptCount: Number(record.attemptCount),
    availableAt: reviveDate(record.availableAt),
    claimedBy: record.claimedBy === null || record.claimedBy === undefined ? null : String(record.claimedBy),
    claimedAt: record.claimedAt === null || record.claimedAt === undefined ? null : reviveDate(record.claimedAt),
    lastError: record.lastError === null || record.lastError === undefined ? null : String(record.lastError),
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt)
  };
}

export function reviveStore(raw: Record<string, unknown>): PersistenceStore {
  const store = createEmptyStore();

  const cases = (raw.cases ?? {}) as Record<string, Record<string, unknown>>;
  for (const [caseId, record] of Object.entries(cases)) {
    store.cases[caseId] = reviveCaseRecord(record);
  }

  const eventsByCase = (raw.eventsByCase ?? {}) as Record<string, Record<string, unknown>[]>;
  for (const [caseId, events] of Object.entries(eventsByCase)) {
    store.eventsByCase[caseId] = events.map((event) => reviveStoredEvent(event));
  }

  const currentState = (raw.currentState ?? {}) as Record<PersistenceCurrentStateTableName, Record<string, Record<string, unknown>>>;
  for (const tableName of Object.keys(store.currentState) as PersistenceCurrentStateTableName[]) {
    const table = currentState[tableName] ?? {};
    for (const [id, record] of Object.entries(table)) {
      store.currentState[tableName][id] = reviveCurrentStateRecord(record);
    }
  }

  const projections = (raw.caseListProjection ?? {}) as Record<string, Record<string, unknown>>;
  for (const [caseId, record] of Object.entries(projections)) {
    store.caseListProjection[caseId] = reviveCaseListProjectionRecord(record);
  }

  const checkpoints = (raw.checkpointsByCase ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  for (const [caseId, entries] of Object.entries(checkpoints)) {
    store.checkpointsByCase[caseId] = {};
    for (const [revision, record] of Object.entries(entries)) {
      store.checkpointsByCase[caseId]![revision] = reviveCheckpointRecord(record);
    }
  }

  const dedup = (raw.dedup ?? {}) as Record<string, Record<string, unknown>>;
  for (const [key, record] of Object.entries(dedup)) {
    store.dedup[key] = reviveDedupRecord(record);
  }

  const outbox = (raw.outbox ?? {}) as Record<string, Record<string, unknown>>;
  for (const [key, record] of Object.entries(outbox)) {
    store.outbox[key] = reviveOutboxRecord(record);
  }

  return store;
}
