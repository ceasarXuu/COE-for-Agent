import { randomUUID } from 'node:crypto';

import { assertRevisionMatch, type ActorContext } from '@coe/domain';
import { type Kysely, type Transaction } from 'kysely';

import type { JsonValue, PersistenceDatabase } from '../schema.js';

type DatabaseExecutor = Kysely<PersistenceDatabase> | Transaction<PersistenceDatabase>;

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

export class EventStoreRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async appendEvent(input: AppendEventInput): Promise<AppendEventResult> {
    return this.db.transaction().execute(async (trx) => this.appendEventInExecutor(trx, input));
  }

  async appendEventInExecutor(executor: DatabaseExecutor, input: AppendEventInput): Promise<AppendEventResult> {
    const currentCase = await executor
      .selectFrom('cases')
      .select(['id', 'revision'])
      .where('id', '=', input.caseId)
      .forUpdate()
      .executeTakeFirst();

    const actualRevision = currentCase?.revision ?? 0;
    assertRevisionMatch(input.caseId, input.expectedRevision, actualRevision);

    const nextRevision = actualRevision + 1;
    const eventId = randomUUID();

    await executor
      .insertInto('investigation_events')
      .values({
        event_id: eventId,
        case_id: input.caseId,
        case_revision: nextRevision,
        event_type: input.eventType,
        command_name: input.commandName,
        actor: input.actor as unknown as JsonValue,
        payload: input.payload,
        metadata: input.metadata
      })
      .execute();

    await executor
      .insertInto('cases')
      .values({
        id: input.caseId,
        title: null,
        severity: null,
        status: 'active',
        stage: 'intake',
        revision: nextRevision,
        payload: {}
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          revision: nextRevision,
          updated_at: new Date()
        })
      )
      .execute();

    return {
      eventId,
      caseRevision: nextRevision
    };
  }

  async listForReplay(range: ReplayRange): Promise<StoredEvent[]> {
    const rows = await this.db
      .selectFrom('investigation_events')
      .select([
        'event_id',
        'case_id',
        'case_revision',
        'event_type',
        'command_name',
        'actor',
        'payload',
        'metadata',
        'created_at'
      ])
      .where('case_id', '=', range.caseId)
      .where('case_revision', '>', range.fromRevisionExclusive)
      .where('case_revision', '<=', range.toRevisionInclusive)
      .orderBy('case_revision', 'asc')
      .execute();

    return rows.map((row) => ({
      eventId: row.event_id,
      caseId: row.case_id,
      caseRevision: row.case_revision,
      eventType: row.event_type,
      commandName: row.command_name,
      actor: row.actor,
      payload: row.payload,
      metadata: row.metadata,
      createdAt: row.created_at as Date
    }));
  }

  async listCaseEvents(caseId: string, toRevisionInclusive?: number): Promise<StoredEvent[]> {
    let query = this.db
      .selectFrom('investigation_events')
      .select([
        'event_id',
        'case_id',
        'case_revision',
        'event_type',
        'command_name',
        'actor',
        'payload',
        'metadata',
        'created_at'
      ])
      .where('case_id', '=', caseId);

    if (typeof toRevisionInclusive === 'number') {
      query = query.where('case_revision', '<=', toRevisionInclusive);
    }

    const rows = await query.orderBy('case_revision', 'asc').execute();

    return rows.map((row) => ({
      eventId: row.event_id,
      caseId: row.case_id,
      caseRevision: row.case_revision,
      eventType: row.event_type,
      commandName: row.command_name,
      actor: row.actor,
      payload: row.payload,
      metadata: row.metadata,
      createdAt: row.created_at as Date
    }));
  }
}