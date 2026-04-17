import { createCommandResult, transitionCanonicalHypothesisStatus } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  toJsonValue
} from './shared.js';
import { recordPayload } from '../shared/record-helpers.js';

interface HypothesisSetStatusInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  hypothesisId: string;
  newStatus: 'blocked' | 'confirmed' | 'rejected' | 'unverified';
  reason?: string;
}

export async function handleHypothesisSetStatus(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<HypothesisSetStatusInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.hypothesis.set_status',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const hypothesisRecord = await requireRecord(trx, 'hypotheses', payload.hypothesisId, payload.caseId);
        const currentStatus = (hypothesisRecord.status ?? 'unverified') as 'unverified' | 'blocked' | 'confirmed' | 'rejected';
        const nextStatus = transitionCanonicalHypothesisStatus(currentStatus, payload.newStatus);

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.hypothesis.status_updated',
          commandName: 'investigation.hypothesis.set_status',
          actor: actorContext,
          payload: toJsonValue({
            hypothesisId: payload.hypothesisId,
            previousStatus: currentStatus,
            newStatus: nextStatus,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('hypotheses', {
          id: payload.hypothesisId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextStatus,
          payload: toJsonValue({
            ...recordPayload(hypothesisRecord),
            status: nextStatus
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.hypothesisId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
