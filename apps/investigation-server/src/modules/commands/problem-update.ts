import { createCommandResult } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  toJsonValue
} from './shared.js';
import { recordPayload, stringArray, stringValue } from '../shared/record-helpers.js';

interface ProblemUpdateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  problemId: string;
  title?: string;
  description?: string;
  environment?: string;
  symptoms?: string[];
  resolutionCriteria?: string[];
}

export async function handleProblemUpdate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ProblemUpdateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.problem.update',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const problemRecord = await requireRecord(trx, 'problems', payload.problemId, payload.caseId);
        const currentPayload = recordPayload(problemRecord);

        const nextPayload = {
          ...currentPayload,
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.description ? { description: payload.description } : {}),
          ...(payload.environment ? { environment: payload.environment } : {}),
          ...(payload.symptoms ? { symptoms: payload.symptoms } : {}),
          ...(payload.resolutionCriteria ? { resolutionCriteria: payload.resolutionCriteria } : {})
        };

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'problem.updated',
          commandName: 'investigation.problem.update',
          actor: actorContext,
          payload: toJsonValue({
            problemId: payload.problemId,
            title: payload.title ?? null,
            description: payload.description ?? null,
            environment: payload.environment ?? null,
            symptoms: payload.symptoms ?? null,
            resolutionCriteria: payload.resolutionCriteria ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('problems', {
          id: payload.problemId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: problemRecord.status ?? null,
          payload: toJsonValue(nextPayload)
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.problemId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
