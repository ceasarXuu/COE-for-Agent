import { createCommandResult, createGapId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  syncCaseListProjection,
  toJsonValue
} from './shared.js';

interface GapOpenInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  question: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  blockedRefs?: string[];
}

export async function handleGapOpen(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<GapOpenInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.gap.open',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const gapId = createGapId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'gap.opened',
          commandName: 'investigation.gap.open',
          actor: actorContext,
          payload: toJsonValue({
            gapId,
            question: payload.question,
            priority: payload.priority,
            status: 'open',
            blockedRefs: payload.blockedRefs ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('gaps', {
          id: gapId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'open',
          payload: toJsonValue({
            id: gapId,
            caseId: payload.caseId,
            question: payload.question,
            priority: payload.priority,
            status: 'open',
            blockedRefs: payload.blockedRefs ?? []
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [gapId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}