import { createCommandResult, transitionRepairAttemptStatus } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  toJsonValue
} from './shared.js';
import { recordPayload } from '../shared/record-helpers.js';

interface RepairAttemptSetStatusInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  repairAttemptId: string;
  newStatus: 'running' | 'effective' | 'ineffective';
  reason?: string;
}

export async function handleRepairAttemptSetStatus(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<RepairAttemptSetStatusInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.repair_attempt.set_status',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const repairAttemptRecord = await requireRecord(trx, 'repair_attempts', payload.repairAttemptId, payload.caseId);
        const currentStatus = (repairAttemptRecord.status ?? 'proposed') as 'proposed' | 'running' | 'effective' | 'ineffective';
        const nextStatus = transitionRepairAttemptStatus(currentStatus, payload.newStatus);

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.repair_attempt.status_updated',
          commandName: 'investigation.repair_attempt.set_status',
          actor: actorContext,
          payload: toJsonValue({
            repairAttemptId: payload.repairAttemptId,
            previousStatus: currentStatus,
            newStatus: nextStatus,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('repair_attempts', {
          id: payload.repairAttemptId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...recordPayload(repairAttemptRecord),
            status: nextStatus
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.repairAttemptId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
