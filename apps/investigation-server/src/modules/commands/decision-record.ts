import { createCommandResult, createDecisionId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, requireRecords, toJsonValue } from './shared.js';

interface DecisionRecordInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  inquiryId?: string;
  title: string;
  decisionKind:
    | 'close_inquiry'
    | 'reject_hypothesis'
    | 'favor_hypothesis'
    | 'ready_to_patch'
    | 'accept_residual'
    | 'declare_root_cause'
    | 'deprioritize_branch'
    | 'escalate_sampling'
    | 'close_case';
  statement: string;
  supportingFactIds?: string[];
  supportingExperimentIds?: string[];
  supportingHypothesisIds?: string[];
  rationale?: string;
}

export async function handleDecisionRecord(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<DecisionRecordInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.decision.record',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        if (payload.inquiryId) {
          await requireRecords(trx, 'inquiries', [payload.inquiryId], payload.caseId);
        }

        await requireRecords(trx, 'facts', payload.supportingFactIds, payload.caseId);
        await requireRecords(trx, 'experiments', payload.supportingExperimentIds, payload.caseId);
        await requireRecords(trx, 'hypotheses', payload.supportingHypothesisIds, payload.caseId);

        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const decisionId = createDecisionId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'decision.recorded',
          commandName: 'investigation.decision.record',
          actor: actorContext,
          payload: toJsonValue({
            decisionId,
            inquiryId: payload.inquiryId ?? null,
            title: payload.title,
            decisionKind: payload.decisionKind,
            statement: payload.statement,
            supportingFactIds: payload.supportingFactIds ?? [],
            supportingExperimentIds: payload.supportingExperimentIds ?? [],
            supportingHypothesisIds: payload.supportingHypothesisIds ?? [],
            rationale: payload.rationale ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('decisions', {
          id: decisionId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          payload: toJsonValue({
            id: decisionId,
            caseId: payload.caseId,
            inquiryId: payload.inquiryId ?? null,
            title: payload.title,
            decisionKind: payload.decisionKind,
            statement: payload.statement,
            supportingFactIds: payload.supportingFactIds ?? [],
            supportingExperimentIds: payload.supportingExperimentIds ?? [],
            supportingHypothesisIds: payload.supportingHypothesisIds ?? [],
            rationale: payload.rationale ?? null
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [decisionId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}