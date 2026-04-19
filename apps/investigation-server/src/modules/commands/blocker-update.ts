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

interface BlockerUpdateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  blockerId: string;
  description?: string;
  possibleWorkarounds?: string[];
}

export async function handleBlockerUpdate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<BlockerUpdateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.blocker.update',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const blockerRecord = await requireRecord(trx, 'blockers', payload.blockerId, payload.caseId);
        const currentPayload = recordPayload(blockerRecord);

        const nextPayload = {
          ...currentPayload,
          ...(payload.description ? { description: payload.description } : {}),
          ...(payload.possibleWorkarounds ? { possibleWorkarounds: payload.possibleWorkarounds } : {})
        };

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.blocker.updated',
          commandName: 'investigation.blocker.update',
          actor: actorContext,
          payload: toJsonValue({
            blockerId: payload.blockerId,
            description: payload.description ?? null,
            possibleWorkarounds: payload.possibleWorkarounds ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('blockers', {
          id: payload.blockerId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: blockerRecord.status ?? null,
          payload: toJsonValue(nextPayload)
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
