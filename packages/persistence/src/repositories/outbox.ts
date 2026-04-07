import { randomUUID } from 'node:crypto';

import { type Kysely, type Selectable } from 'kysely';

import type { PersistenceDatabase, ProjectionOutboxTable } from '../schema.js';

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
  constructor(private readonly db: Kysely<PersistenceDatabase>) {}

  async enqueue(input: EnqueueOutboxInput): Promise<OutboxRecord> {
    const row = await this.db
      .insertInto('projection_outbox')
      .values({
        outbox_id: randomUUID(),
        case_id: input.caseId,
        head_revision: input.headRevision,
        event_id: input.eventId,
        task_type: input.taskType,
        status: 'pending',
        attempt_count: 0,
        available_at: new Date(),
        claimed_by: null,
        claimed_at: null,
        last_error: null
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapOutboxRow(row);
  }

  async claimNext(input: ClaimNextInput): Promise<OutboxRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const nextRow = await trx
        .selectFrom('projection_outbox')
        .selectAll()
        .where('task_type', '=', input.taskType)
        .where('status', '=', 'pending')
        .where('available_at', '<=', new Date())
        .orderBy('created_at', 'asc')
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();

      if (!nextRow) {
        return null;
      }

      const claimed = await trx
        .updateTable('projection_outbox')
        .set({
          status: 'processing',
          claimed_by: input.workerId,
          claimed_at: new Date(),
          attempt_count: nextRow.attempt_count + 1,
          updated_at: new Date(),
          last_error: null
        })
        .where('outbox_id', '=', nextRow.outbox_id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return mapOutboxRow(claimed);
    });
  }

  async markFailed(input: { outboxId: string; errorMessage: string }): Promise<void> {
    await this.db
      .updateTable('projection_outbox')
      .set({
        status: 'pending',
        available_at: new Date(),
        claimed_by: null,
        claimed_at: null,
        last_error: input.errorMessage,
        updated_at: new Date()
      })
      .where('outbox_id', '=', input.outboxId)
      .execute();
  }

  async markDone(outboxId: string): Promise<void> {
    await this.db
      .updateTable('projection_outbox')
      .set({
        status: 'completed',
        updated_at: new Date()
      })
      .where('outbox_id', '=', outboxId)
      .execute();
  }
}

function mapOutboxRow(row: Selectable<ProjectionOutboxTable>): OutboxRecord {
  return {
    outboxId: row.outbox_id,
    caseId: row.case_id,
    headRevision: row.head_revision,
    eventId: row.event_id,
    taskType: row.task_type,
    status: row.status,
    attemptCount: row.attempt_count,
    availableAt: row.available_at as Date,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at as Date | null,
    lastError: row.last_error
  };
}