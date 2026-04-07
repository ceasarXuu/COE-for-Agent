import { type Kysely, type Transaction } from 'kysely';

import type { JsonValue, PersistenceDatabase } from '../schema.js';

type DatabaseExecutor = Kysely<PersistenceDatabase> | Transaction<PersistenceDatabase>;
const PENDING_EVENT_ID = '__pending__';
const PENDING_COMMAND_RESULT = { pending: true } as const satisfies JsonValue;

export interface ClaimDedupInput {
  caseId: string;
  toolName: string;
  idempotencyKey: string;
}

export type ClaimDedupResult =
  | {
      claimed: true;
    }
  | {
      claimed: false;
      eventId: string;
      commandResult: JsonValue;
    };

export interface DedupRecordInput {
  caseId: string;
  toolName: string;
  idempotencyKey: string;
  eventId: string;
  commandResult?: JsonValue;
}

export interface DedupRecordResult {
  duplicate: boolean;
  eventId: string;
}

export interface CompleteDedupInput extends ClaimDedupInput {
  eventId: string;
  commandResult: JsonValue;
}

export class CommandDedupRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async claim(input: ClaimDedupInput): Promise<ClaimDedupResult> {
    const inserted = await this.db
      .insertInto('command_dedup')
      .values({
        case_id: input.caseId,
        tool_name: input.toolName,
        idempotency_key: input.idempotencyKey,
        event_id: PENDING_EVENT_ID,
        command_result: PENDING_COMMAND_RESULT
      })
      .onConflict((oc) => oc.columns(['case_id', 'tool_name', 'idempotency_key']).doNothing())
      .returning(['event_id'])
      .executeTakeFirst();

    if (inserted) {
      return {
        claimed: true
      };
    }

    const existing = await this.db
      .selectFrom('command_dedup')
      .select(['event_id', 'command_result'])
      .where('case_id', '=', input.caseId)
      .where('tool_name', '=', input.toolName)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirstOrThrow();

    return {
      claimed: false,
      eventId: existing.event_id,
      commandResult: existing.command_result
    };
  }

  async complete(input: CompleteDedupInput): Promise<void> {
    await this.db
      .updateTable('command_dedup')
      .set({
        event_id: input.eventId,
        command_result: input.commandResult
      })
      .where('case_id', '=', input.caseId)
      .where('tool_name', '=', input.toolName)
      .where('idempotency_key', '=', input.idempotencyKey)
      .execute();
  }

  async record(input: DedupRecordInput): Promise<DedupRecordResult> {
    const claim = await this.claim({
      caseId: input.caseId,
      toolName: input.toolName,
      idempotencyKey: input.idempotencyKey
    });

    if (claim.claimed) {
      await this.complete({
        caseId: input.caseId,
        toolName: input.toolName,
        idempotencyKey: input.idempotencyKey,
        eventId: input.eventId,
        commandResult: input.commandResult ?? {}
      });

      return {
        duplicate: false,
        eventId: input.eventId
      };
    }

    return {
      duplicate: true,
      eventId: claim.eventId
    };
  }
}