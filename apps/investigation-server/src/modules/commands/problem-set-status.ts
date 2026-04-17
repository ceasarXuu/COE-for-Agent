import { createCommandResult, transitionProblemStatus } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  toJsonValue
} from './shared.js';
import { recordPayload, stringValue } from '../shared/record-helpers.js';

interface ProblemSetStatusInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  problemId: string;
  newStatus: 'resolved' | 'abandoned';
  reason?: string;
}

export async function handleProblemSetStatus(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ProblemSetStatusInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.problem.set_status',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const problemRecord = await requireRecord(trx, 'problems', payload.problemId, payload.caseId);
        const currentPayload = recordPayload(problemRecord);
        const currentStatus = stringValue(problemRecord.status) ?? 'open';
        const nextStatus = transitionProblemStatus(currentStatus as 'open' | 'resolved' | 'abandoned', payload.newStatus);

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'problem.status_updated',
          commandName: 'investigation.problem.set_status',
          actor: actorContext,
          payload: toJsonValue({
            problemId: payload.problemId,
            previousStatus: currentStatus,
            newStatus: nextStatus,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('problems', {
          id: payload.problemId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...currentPayload,
            status: nextStatus
          })
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
