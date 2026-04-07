import { createCommandResult, transitionGapStatus, type GapStatus } from '@coe/domain';
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

interface GapResolveInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  gapId: string;
  status: 'resolved' | 'waived';
  reason?: string;
  resolutionFactIds?: string[];
  resolutionExperimentIds?: string[];
}

export async function handleGapResolve(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<GapResolveInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.gap.resolve',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecords(trx, 'facts', payload.resolutionFactIds, payload.caseId);
        await requireRecords(trx, 'experiments', payload.resolutionExperimentIds, payload.caseId);

        const currentState = new CurrentStateRepository(trx);
        const gap = await requireRecord(trx, 'gaps', payload.gapId, payload.caseId);
        const gapPayload = asJsonObject(gap.payload);
        const currentStatus = (gap.status ?? gapPayload.status ?? 'open') as GapStatus;
        const nextStatus = transitionGapStatus(currentStatus, payload.status);
        const eventStore = new EventStoreRepository(trx);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'gap.resolved',
          commandName: 'investigation.gap.resolve',
          actor: actorContext,
          payload: toJsonValue({
            gapId: payload.gapId,
            status: nextStatus,
            reason: payload.reason ?? null,
            resolutionFactIds: payload.resolutionFactIds ?? [],
            resolutionExperimentIds: payload.resolutionExperimentIds ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('gaps', {
          id: gap.id,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...gapPayload,
            status: nextStatus,
            reason: payload.reason ?? null,
            resolutionFactIds: payload.resolutionFactIds ?? [],
            resolutionExperimentIds: payload.resolutionExperimentIds ?? []
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.gapId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}