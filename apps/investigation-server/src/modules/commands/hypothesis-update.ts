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
import { recordPayload } from '../shared/record-helpers.js';

interface HypothesisUpdateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  hypothesisId: string;
  title?: string;
  statement?: string;
  falsificationCriteria?: string[];
}

export async function handleHypothesisUpdate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<HypothesisUpdateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.hypothesis.update',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const hypothesisRecord = await requireRecord(trx, 'hypotheses', payload.hypothesisId, payload.caseId);
        const currentPayload = recordPayload(hypothesisRecord);

        const nextPayload = {
          ...currentPayload,
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.statement ? { statement: payload.statement } : {}),
          ...(payload.falsificationCriteria ? { falsificationCriteria: payload.falsificationCriteria } : {})
        };

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.hypothesis.updated',
          commandName: 'investigation.hypothesis.update',
          actor: actorContext,
          payload: toJsonValue({
            hypothesisId: payload.hypothesisId,
            title: payload.title ?? null,
            statement: payload.statement ?? null,
            falsificationCriteria: payload.falsificationCriteria ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('hypotheses', {
          id: payload.hypothesisId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: hypothesisRecord.status ?? null,
          payload: toJsonValue(nextPayload)
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
