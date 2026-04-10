import { readPersistenceStore, writePersistenceStore, type PersistenceExecutor } from '../client.js';
import type { JsonValue } from '../schema.js';

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

function dedupKey(input: ClaimDedupInput): string {
  return `${input.caseId}::${input.toolName}::${input.idempotencyKey}`;
}

export class CommandDedupRepository {
  constructor(private readonly db: PersistenceExecutor) {}

  async claim(input: ClaimDedupInput): Promise<ClaimDedupResult> {
    return writePersistenceStore(this.db, (store) => {
      const key = dedupKey(input);
      const existing = store.dedup[key];

      if (!existing) {
        store.dedup[key] = {
          eventId: PENDING_EVENT_ID,
          commandResult: PENDING_COMMAND_RESULT,
          createdAt: new Date()
        };
        return { claimed: true } as const;
      }

      return {
        claimed: false,
        eventId: existing.eventId,
        commandResult: structuredClone(existing.commandResult)
      } as const;
    });
  }

  async complete(input: CompleteDedupInput): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      store.dedup[dedupKey(input)] = {
        eventId: input.eventId,
        commandResult: structuredClone(input.commandResult),
        createdAt: store.dedup[dedupKey(input)]?.createdAt ?? new Date()
      };
    });
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
