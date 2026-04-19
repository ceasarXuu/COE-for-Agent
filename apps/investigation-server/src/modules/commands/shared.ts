import { type ActorContext, type CommandResult } from '@coe/domain';
import {
  CommandDedupRepository,
  CaseListProjectionRepository,
  CurrentStateRepository,
  type CurrentStateNodeRecord,
  type CurrentStateTableName,
  type JsonValue
} from '@coe/persistence';

import type { InvestigationServerTransaction } from '../../services.js';
import { recordPayload, stringValue } from '../shared/record-helpers.js';

export function toJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

export function asJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function asValidatedInput<T>(value: Record<string, unknown>): T {
  return value as unknown as T;
}

export function requireActorContext(input: Record<string, unknown>): ActorContext {
  const actorContext = asJsonObject(input.actorContext);

  if (
    typeof actorContext.actorType !== 'string'
    || typeof actorContext.actorId !== 'string'
    || typeof actorContext.sessionId !== 'string'
    || typeof actorContext.role !== 'string'
    || typeof actorContext.issuer !== 'string'
    || typeof actorContext.authMode !== 'string'
  ) {
    throw new Error('actorContext is required');
  }

  return actorContext as unknown as ActorContext;
}

interface ExecuteIdempotentMutationOptions {
  commandName: string;
  caseId?: string;
  idempotencyKey: string;
  actorContext: ActorContext;
}

function idempotencyScope(caseId: string | undefined, actorContext: ActorContext): string {
  return caseId ?? `session:${actorContext.sessionId}`;
}

export async function executeIdempotentMutation(
  trx: InvestigationServerTransaction,
  options: ExecuteIdempotentMutationOptions,
  operation: () => Promise<CommandResult>
): Promise<CommandResult> {
  const dedup = new CommandDedupRepository(trx);
  const scopeKey = idempotencyScope(options.caseId, options.actorContext);
  const claim = await dedup.claim({
    caseId: scopeKey,
    toolName: options.commandName,
    idempotencyKey: options.idempotencyKey
  });

  if (!claim.claimed) {
    return claim.commandResult as unknown as CommandResult;
  }

  const result = await operation();

  if (typeof result.eventId !== 'string' || result.eventId.length === 0) {
    throw new Error(`eventId is required for ${options.commandName}`);
  }

  await dedup.complete({
    caseId: scopeKey,
    toolName: options.commandName,
    idempotencyKey: options.idempotencyKey,
    eventId: result.eventId,
    commandResult: toJsonValue(result)
  });

  return result;
}

export async function requireCaseRecord(trx: InvestigationServerTransaction, caseId: string) {
  const currentState = new CurrentStateRepository(trx);
  const caseRecord = await currentState.getCase(caseId);

  if (!caseRecord) {
    throw new Error(`Case not found: ${caseId}`);
  }

  return caseRecord;
}

export async function requireRecord(
  trx: InvestigationServerTransaction,
  tableName: CurrentStateTableName,
  id: string,
  caseId?: string
): Promise<CurrentStateNodeRecord> {
  const currentState = new CurrentStateRepository(trx);
  const record = await currentState.getRecord(tableName, id);

  if (!record || (caseId && record.caseId !== caseId)) {
    throw new Error(`${tableName.slice(0, -1)} not found: ${id}`);
  }

  return record;
}

export async function requireRecords(
  trx: InvestigationServerTransaction,
  tableName: CurrentStateTableName,
  ids: string[] | undefined,
  caseId?: string
): Promise<void> {
  for (const id of ids ?? []) {
    await requireRecord(trx, tableName, id, caseId);
  }
}

export async function syncCaseListProjection(trx: InvestigationServerTransaction, caseId: string): Promise<void> {
  const currentState = new CurrentStateRepository(trx);
  const caseList = new CaseListProjectionRepository(trx);
  const caseRecord = await currentState.getCase(caseId);

  if (!caseRecord) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const hypotheses = await currentState.listRecordsByCase('hypotheses', caseId);
  const gaps = await currentState.listRecordsByCase('gaps', caseId);
  const residuals = await currentState.listRecordsByCase('residuals', caseId);
  const casePayload = recordPayload(caseRecord);

  const activeHypothesisCount = hypotheses.filter((record) => {
    const payload = recordPayload(record);
    const status = stringValue(record.status) ?? stringValue(payload.status) ?? 'proposed';
    return status !== 'rejected';
  }).length;

  const openGapCount = gaps.filter((record) => {
    const payload = recordPayload(record);
    const status = stringValue(record.status) ?? stringValue(payload.status) ?? 'open';
    return status !== 'resolved' && status !== 'waived';
  }).length;

  const openResidualCount = residuals.filter((record) => {
    const payload = recordPayload(record);
    const status = stringValue(record.status) ?? stringValue(payload.status) ?? 'open';
    return status !== 'resolved' && status !== 'accepted';
  }).length;

  await caseList.upsert({
    caseId,
    title: caseRecord.title ?? null,
    summary: stringValue(casePayload.objective) ?? stringValue(casePayload.summary) ?? null,
    severity: caseRecord.severity ?? null,
    status: caseRecord.status,
    stage: caseRecord.stage,
    activeHypothesisCount,
    openGapCount,
    openResidualCount
  });
}
