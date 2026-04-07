import { advanceCaseStage, createCommandResult, type CaseStage, type CaseStatus } from '@coe/domain';
import { EventStoreRepository, CurrentStateRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { recordPayload } from '../shared/record-helpers.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, requireCaseRecord, syncCaseListProjection, toJsonValue } from './shared.js';

interface CaseAdvanceStageInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  stage: CaseStage;
  reason?: string;
}

export async function handleCaseAdvanceStage(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<CaseAdvanceStageInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.case.advance_stage',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const caseRecord = await requireCaseRecord(trx, payload.caseId);
        const lifecycle = advanceCaseStage(
          {
            status: caseRecord.status as CaseStatus,
            stage: caseRecord.stage as CaseStage
          },
          payload.stage
        );

        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'case.stage_advanced',
          commandName: 'investigation.case.advance_stage',
          actor: actorContext,
          payload: toJsonValue({
            stage: lifecycle.stage,
            status: lifecycle.status,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        const casePayload = recordPayload(caseRecord);
        await currentState.upsertCase({
          id: caseRecord.id,
          title: caseRecord.title ?? null,
          severity: caseRecord.severity ?? null,
          status: lifecycle.status,
          stage: lifecycle.stage,
          revision: result.caseRevision,
          payload: toJsonValue({
            ...casePayload,
            status: lifecycle.status,
            stage: lifecycle.stage,
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