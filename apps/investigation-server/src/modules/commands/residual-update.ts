import { createCommandResult, transitionResidualStatus, type ResidualStatus } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  asJsonObject,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  requireRecords,
  syncCaseListProjection,
  toJsonValue
} from './shared.js';

interface ResidualUpdateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  residualId: string;
  newStatus: 'reduced' | 'resolved' | 'accepted';
  rationale?: string;
  reasonFactIds?: string[];
  reasonHypothesisIds?: string[];
}

export async function handleResidualUpdate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ResidualUpdateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.residual.update',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecords(trx, 'facts', payload.reasonFactIds, payload.caseId);
        await requireRecords(trx, 'hypotheses', payload.reasonHypothesisIds, payload.caseId);

        const currentState = new CurrentStateRepository(trx);
        const residual = await requireRecord(trx, 'residuals', payload.residualId, payload.caseId);
        const residualPayload = asJsonObject(residual.payload);
        const currentStatus = (residual.status ?? residualPayload.status ?? 'open') as ResidualStatus;
        const nextStatus = transitionResidualStatus(currentStatus, payload.newStatus);
        const eventStore = new EventStoreRepository(trx);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'residual.updated',
          commandName: 'investigation.residual.update',
          actor: actorContext,
          payload: toJsonValue({
            residualId: payload.residualId,
            newStatus: nextStatus,
            rationale: payload.rationale ?? null,
            reasonFactIds: payload.reasonFactIds ?? [],
            reasonHypothesisIds: payload.reasonHypothesisIds ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('residuals', {
          id: residual.id,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...residualPayload,
            status: nextStatus,
            rationale: payload.rationale ?? null,
            reasonFactIds: payload.reasonFactIds ?? [],
            reasonHypothesisIds: payload.reasonHypothesisIds ?? []
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.residualId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}