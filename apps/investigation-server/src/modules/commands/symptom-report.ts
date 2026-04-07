import { createCommandResult, createSymptomId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface SymptomReportInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  statement: string;
  severity: string;
  reproducibility: string;
  affectedRefs?: string[];
}

export async function handleSymptomReport(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<SymptomReportInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.symptom.report',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const symptomId = createSymptomId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'symptom.reported',
          commandName: 'investigation.symptom.report',
          actor: actorContext,
          payload: toJsonValue({
            symptomId,
            statement: payload.statement,
            severity: payload.severity,
            reproducibility: payload.reproducibility,
            affectedRefs: payload.affectedRefs ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('symptoms', {
          id: symptomId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          payload: toJsonValue({
            id: symptomId,
            caseId: payload.caseId,
            statement: payload.statement,
            severity: payload.severity,
            reproducibility: payload.reproducibility,
            affectedRefs: payload.affectedRefs ?? []
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [symptomId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}