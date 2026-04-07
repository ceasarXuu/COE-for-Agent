import { createCommandResult, transitionExperimentStatus, type ExperimentStatus } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  asJsonObject,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  requireRecords,
  toJsonValue
} from './shared.js';

interface ExperimentRecordResultInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  experimentId: string;
  status: 'completed' | 'inconclusive' | 'canceled';
  summary: string;
  producedArtifactIds?: string[];
  producedFactIds?: string[];
}

export async function handleExperimentRecordResult(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ExperimentRecordResultInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.experiment.record_result',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecords(trx, 'artifacts', payload.producedArtifactIds, payload.caseId);
        await requireRecords(trx, 'facts', payload.producedFactIds, payload.caseId);

        const currentState = new CurrentStateRepository(trx);
        const experiment = await requireRecord(trx, 'experiments', payload.experimentId, payload.caseId);
        const experimentPayload = asJsonObject(experiment.payload);
        const currentStatus = (experiment.status ?? experimentPayload.status ?? 'planned') as ExperimentStatus;
        const nextStatus = transitionExperimentStatus(currentStatus, payload.status);
        const eventStore = new EventStoreRepository(trx);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'experiment.result_recorded',
          commandName: 'investigation.experiment.record_result',
          actor: actorContext,
          payload: toJsonValue({
            experimentId: payload.experimentId,
            status: nextStatus,
            summary: payload.summary,
            producedArtifactIds: payload.producedArtifactIds ?? [],
            producedFactIds: payload.producedFactIds ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('experiments', {
          id: experiment.id,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...experimentPayload,
            status: nextStatus,
            summary: payload.summary,
            producedArtifactIds: payload.producedArtifactIds ?? [],
            producedFactIds: payload.producedFactIds ?? []
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.experimentId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}