import { createCommandResult, createHypothesisId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  requireRecords,
  syncCaseListProjection,
  toJsonValue
} from './shared.js';

interface HypothesisProposeInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  inquiryId: string;
  title: string;
  statement: string;
  level: 'phenomenon' | 'mechanism' | 'trigger' | 'root_cause';
  explainsSymptomIds: string[];
  dependsOnFactIds?: string[];
  falsificationCriteria: string[];
}

export async function handleHypothesisPropose(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<HypothesisProposeInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.hypothesis.propose',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecord(trx, 'inquiries', payload.inquiryId, payload.caseId);
        await requireRecords(trx, 'symptoms', payload.explainsSymptomIds, payload.caseId);
        await requireRecords(trx, 'facts', payload.dependsOnFactIds, payload.caseId);

        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const hypothesisId = createHypothesisId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'hypothesis.proposed',
          commandName: 'investigation.hypothesis.propose',
          actor: actorContext,
          payload: toJsonValue({
            hypothesisId,
            inquiryId: payload.inquiryId,
            title: payload.title,
            statement: payload.statement,
            level: payload.level,
            status: 'proposed',
            explainsSymptomIds: payload.explainsSymptomIds,
            dependsOnFactIds: payload.dependsOnFactIds ?? [],
            falsificationCriteria: payload.falsificationCriteria
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('hypotheses', {
          id: hypothesisId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'proposed',
          payload: toJsonValue({
            id: hypothesisId,
            caseId: payload.caseId,
            inquiryId: payload.inquiryId,
            title: payload.title,
            statement: payload.statement,
            level: payload.level,
            status: 'proposed',
            explainsSymptomIds: payload.explainsSymptomIds,
            dependsOnFactIds: payload.dependsOnFactIds ?? [],
            falsificationCriteria: payload.falsificationCriteria
          })
        });

        await syncCaseListProjection(trx, payload.caseId);

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [hypothesisId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}