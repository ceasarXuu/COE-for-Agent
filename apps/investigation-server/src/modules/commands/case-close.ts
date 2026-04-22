import { createCommandResult, transitionCaseStatus, type CaseStatus } from '@coe/domain';
import { EventStoreRepository, CurrentStateRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { recordPayload } from '../shared/record-helpers.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireCaseRecord,
  syncCaseListProjection,
  toJsonValue
} from './shared.js';

interface CaseCloseInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  reason?: string;
}

export async function handleCaseClose(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<CaseCloseInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.case.close',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const caseRecord = await requireCaseRecord(trx, payload.caseId);
        const nextStatus = transitionCaseStatus(caseRecord.status as CaseStatus, 'closed');

        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'case.closed',
          commandName: 'investigation.case.close',
          actor: actorContext,
          payload: toJsonValue({
            status: nextStatus,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        const casePayload = recordPayload(caseRecord);
        await currentState.upsertCase({
          id: caseRecord.id,
          title: caseRecord.title ?? null,
          severity: caseRecord.severity ?? null,
          status: nextStatus,
          revision: result.caseRevision,
          payload: toJsonValue({
            ...casePayload,
            status: nextStatus,
            reason: payload.reason ?? null
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.caseId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
