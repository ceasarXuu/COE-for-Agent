import { createCommandResult } from '@coe/domain';
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

interface RepairAttemptUpdateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  repairAttemptId: string;
  changeSummary?: string;
  scope?: string;
}

export async function handleRepairAttemptUpdate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<RepairAttemptUpdateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.repair_attempt.update',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const repairAttemptRecord = await requireRecord(trx, 'repair_attempts', payload.repairAttemptId, payload.caseId);
        const currentPayload = recordPayload(repairAttemptRecord);

        const nextPayload = {
          ...currentPayload,
          ...(payload.changeSummary ? { changeSummary: payload.changeSummary } : {}),
          ...(payload.scope ? { scope: payload.scope } : {})
        };

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.repair_attempt.updated',
          commandName: 'investigation.repair_attempt.update',
          actor: actorContext,
          payload: toJsonValue({
            repairAttemptId: payload.repairAttemptId,
            changeSummary: payload.changeSummary ?? null,
            scope: payload.scope ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('repair_attempts', {
          id: payload.repairAttemptId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: repairAttemptRecord.status ?? null,
          payload: toJsonValue(nextPayload)
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
