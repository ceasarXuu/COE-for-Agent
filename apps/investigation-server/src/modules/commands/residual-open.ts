import { createCommandResult, createResidualId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecords,
  syncCaseListProjection,
  toJsonValue
} from './shared.js';

interface ResidualOpenInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  statement: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  relatedSymptomIds?: string[];
}

export async function handleResidualOpen(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ResidualOpenInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.residual.open',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecords(trx, 'symptoms', payload.relatedSymptomIds, payload.caseId);

        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const residualId = createResidualId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'residual.opened',
          commandName: 'investigation.residual.open',
          actor: actorContext,
          payload: toJsonValue({
            residualId,
            statement: payload.statement,
            severity: payload.severity,
            status: 'open',
            relatedSymptomIds: payload.relatedSymptomIds ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('residuals', {
          id: residualId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'open',
          payload: toJsonValue({
            id: residualId,
            caseId: payload.caseId,
            statement: payload.statement,
            severity: payload.severity,
            status: 'open',
            relatedSymptomIds: payload.relatedSymptomIds ?? []
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [residualId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}