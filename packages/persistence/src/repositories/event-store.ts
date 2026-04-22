import { randomUUID } from 'node:crypto';

import { assertRevisionMatch, type ActorContext } from '@coe/domain';

import { readPersistenceStore, writePersistenceStore, type PersistenceExecutor, type PersistenceStore, type StoredEvent } from '../client.js';
import type { JsonValue } from '../schema.js';

export interface AppendEventInput {
  caseId: string;
  expectedRevision: number;
  eventType: string;
  commandName: string;
  actor: ActorContext;
  payload: JsonValue;
  metadata: JsonValue & {
    idempotencyKey: string;
  };
}

export interface AppendEventResult {
  eventId: string;
  caseRevision: number;
}

export interface ReplayRange {
  caseId: string;
  fromRevisionExclusive: number;
  toRevisionInclusive: number;
}

export class EventStoreRepository {
  constructor(private readonly db: PersistenceExecutor) {}

  async appendEvent(input: AppendEventInput): Promise<AppendEventResult> {
    return writePersistenceStore(this.db, (store) => appendEventInStore(store, input));
  }

  async appendEventInExecutor(_executor: PersistenceExecutor, input: AppendEventInput): Promise<AppendEventResult> {
    return writePersistenceStore(this.db, (store) => appendEventInStore(store, input));
  }

  async listForReplay(range: ReplayRange): Promise<StoredEvent[]> {
    return readPersistenceStore(this.db, (store) =>
      (store.eventsByCase[range.caseId] ?? [])
        .filter((event) => event.caseRevision > range.fromRevisionExclusive && event.caseRevision <= range.toRevisionInclusive)
        .map((event) => structuredClone(event))
    );
  }

  async listCaseEvents(caseId: string, toRevisionInclusive?: number): Promise<StoredEvent[]> {
    return readPersistenceStore(this.db, (store) =>
      (store.eventsByCase[caseId] ?? [])
        .filter((event) => typeof toRevisionInclusive !== 'number' || event.caseRevision <= toRevisionInclusive)
        .map((event) => structuredClone(event))
    );
  }
}

function appendEventInStore(store: PersistenceStore, input: AppendEventInput): AppendEventResult {
  const currentCase = store.cases[input.caseId];
  const actualRevision = currentCase?.revision ?? 0;
  assertRevisionMatch(input.caseId, input.expectedRevision, actualRevision);

  const nextRevision = actualRevision + 1;
  const eventId = randomUUID();
  const now = new Date();

  const event: StoredEvent = {
    eventId,
    caseId: input.caseId,
    caseRevision: nextRevision,
    eventType: input.eventType,
    commandName: input.commandName,
    actor: structuredClone(input.actor) as unknown as JsonValue,
    payload: structuredClone(input.payload),
    metadata: structuredClone(input.metadata),
    createdAt: now
  };

  if (!store.eventsByCase[input.caseId]) {
    store.eventsByCase[input.caseId] = [];
  }
  store.eventsByCase[input.caseId]!.push(event);

  store.cases[input.caseId] = {
    id: input.caseId,
    title: currentCase?.title ?? null,
    severity: currentCase?.severity ?? null,
    status: currentCase?.status ?? 'active',
    revision: nextRevision,
    payload: structuredClone(currentCase?.payload ?? {}),
    createdAt: currentCase?.createdAt ?? now,
    updatedAt: now
  };

  return {
    eventId,
    caseRevision: nextRevision
  };
}
