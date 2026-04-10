import { randomUUID } from 'node:crypto';

import { readPersistenceStore, writePersistenceStore, type PersistenceExecutor, type StoredOutboxRecord } from '../client.js';

export interface EnqueueOutboxInput {
  caseId: string;
  headRevision: number;
  eventId: string;
  taskType: string;
}

export interface OutboxRecord {
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
}

export interface ClaimNextInput {
  workerId: string;
  taskType: string;
}

export class ProjectionOutboxRepository {
  constructor(private readonly db: PersistenceExecutor) {}

  async enqueue(input: EnqueueOutboxInput): Promise<OutboxRecord> {
    return writePersistenceStore(this.db, (store) => {
      const now = new Date();
      const record: OutboxRecord = {
        outboxId: randomUUID(),
        caseId: input.caseId,
        headRevision: input.headRevision,
        eventId: input.eventId,
        taskType: input.taskType,
        status: 'pending',
        attemptCount: 0,
        availableAt: now,
        claimedBy: null,
        claimedAt: null,
        lastError: null
      };

      store.outbox[record.outboxId] = {
        ...record,
        createdAt: now,
        updatedAt: now
      };

      return record;
    });
  }

  async claimNext(input: ClaimNextInput): Promise<OutboxRecord | null> {
    return writePersistenceStore(this.db, (store) => {
      const next = Object.values(store.outbox)
        .filter((record) => record.taskType === input.taskType && record.status === 'pending' && record.availableAt <= new Date())
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];

      if (!next) {
        return null;
      }

      next.status = 'processing';
      next.claimedBy = input.workerId;
      next.claimedAt = new Date();
      next.attemptCount += 1;
      next.updatedAt = new Date();
      next.lastError = null;

      return toOutboxRecord(next);
    });
  }

  async markFailed(input: { outboxId: string; errorMessage: string }): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      const record = store.outbox[input.outboxId];
      if (!record) {
        return;
      }

      record.status = 'pending';
      record.availableAt = new Date();
      record.claimedBy = null;
      record.claimedAt = null;
      record.lastError = input.errorMessage;
      record.updatedAt = new Date();
    });
  }

  async markDone(outboxId: string): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      const record = store.outbox[outboxId];
      if (!record) {
        return;
      }

      record.status = 'completed';
      record.updatedAt = new Date();
    });
  }
}

function toOutboxRecord(record: StoredOutboxRecord): OutboxRecord {
  return {
    outboxId: record.outboxId,
    caseId: record.caseId,
    headRevision: record.headRevision,
    eventId: record.eventId,
    taskType: record.taskType,
    status: record.status,
    attemptCount: record.attemptCount,
    availableAt: record.availableAt,
    claimedBy: record.claimedBy,
    claimedAt: record.claimedAt,
    lastError: record.lastError
  };
}
