import { createCommandResult, transitionHypothesisStatus, type HypothesisStatus } from '@coe/domain';
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

interface HypothesisUpdateStatusInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  hypothesisId: string;
  newStatus: 'active' | 'favored' | 'weakened' | 'rejected' | 'confirmed';
  reason?: string;
  reasonFactIds?: string[];
  reasonExperimentIds?: string[];
}

export async function handleHypothesisUpdateStatus(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<HypothesisUpdateStatusInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.hypothesis.update_status',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecords(trx, 'facts', payload.reasonFactIds, payload.caseId);
        await requireRecords(trx, 'experiments', payload.reasonExperimentIds, payload.caseId);

        const currentState = new CurrentStateRepository(trx);
        const hypothesis = await requireRecord(trx, 'hypotheses', payload.hypothesisId, payload.caseId);
        const hypothesisPayload = asJsonObject(hypothesis.payload);
        const currentStatus = (hypothesis.status ?? hypothesisPayload.status ?? 'proposed') as HypothesisStatus;
        const nextStatus = transitionHypothesisStatus(currentStatus, payload.newStatus);
        const eventStore = new EventStoreRepository(trx);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'hypothesis.status_updated',
          commandName: 'investigation.hypothesis.update_status',
          actor: actorContext,
          payload: toJsonValue({
            hypothesisId: payload.hypothesisId,
            newStatus: nextStatus,
            reason: payload.reason ?? null,
            reasonFactIds: payload.reasonFactIds ?? [],
            reasonExperimentIds: payload.reasonExperimentIds ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('hypotheses', {
          id: hypothesis.id,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...hypothesisPayload,
            status: nextStatus,
            reason: payload.reason ?? null,
            reasonFactIds: payload.reasonFactIds ?? [],
            reasonExperimentIds: payload.reasonExperimentIds ?? []
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.hypothesisId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}