import { createCommandResult, createExperimentId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  requireRecords,
  toJsonValue
} from './shared.js';

interface ExperimentPlanInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  inquiryId: string;
  title: string;
  objective: string;
  method:
    | 'search'
    | 'instrumentation'
    | 'reproduction'
    | 'compare_versions'
    | 'fault_injection'
    | 'binary_search'
    | 'test_run'
    | 'patch_probe';
  testsHypothesisIds: string[];
  expectedOutcomes: Array<{
    when: string;
    expect: string;
  }>;
  cost?: 'low' | 'medium' | 'high';
  risk?: 'low' | 'medium' | 'high';
}

export async function handleExperimentPlan(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ExperimentPlanInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.experiment.plan',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        await requireRecord(trx, 'inquiries', payload.inquiryId, payload.caseId);
        await requireRecords(trx, 'hypotheses', payload.testsHypothesisIds, payload.caseId);

        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const experimentId = createExperimentId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'experiment.planned',
          commandName: 'investigation.experiment.plan',
          actor: actorContext,
          payload: toJsonValue({
            experimentId,
            inquiryId: payload.inquiryId,
            title: payload.title,
            objective: payload.objective,
            method: payload.method,
            status: 'planned',
            testsHypothesisIds: payload.testsHypothesisIds,
            expectedOutcomes: payload.expectedOutcomes,
            cost: payload.cost ?? null,
            risk: payload.risk ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('experiments', {
          id: experimentId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'planned',
          payload: toJsonValue({
            id: experimentId,
            caseId: payload.caseId,
            inquiryId: payload.inquiryId,
            title: payload.title,
            objective: payload.objective,
            method: payload.method,
            status: 'planned',
            testsHypothesisIds: payload.testsHypothesisIds,
            expectedOutcomes: payload.expectedOutcomes,
            cost: payload.cost ?? null,
            risk: payload.risk ?? null
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [experimentId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}