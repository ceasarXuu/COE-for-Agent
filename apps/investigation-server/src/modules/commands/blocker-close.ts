import { createCommandResult, transitionBlockerStatus } from '@coe/domain';
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

interface BlockerCloseInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  blockerId: string;
  reason?: string;
}

export async function handleBlockerClose(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<BlockerCloseInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.blocker.close',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const blockerRecord = await requireRecord(trx, 'blockers', payload.blockerId, payload.caseId);
        const currentStatus = (blockerRecord.status ?? 'active') as 'active' | 'closed';
        const nextStatus = transitionBlockerStatus(currentStatus, 'closed');

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.blocker.closed',
          commandName: 'investigation.blocker.close',
          actor: actorContext,
          payload: toJsonValue({
            blockerId: payload.blockerId,
            previousStatus: currentStatus,
            newStatus: nextStatus,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('blockers', {
          id: payload.blockerId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...recordPayload(blockerRecord),
            status: nextStatus
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.blockerId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
