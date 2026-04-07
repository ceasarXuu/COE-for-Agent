import { createCommandResult, createFactId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface FactAssertInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  inquiryId?: string;
  statement: string;
  factKind: string;
  polarity: 'positive' | 'negative';
  sourceArtifactIds: string[];
  aboutRefs?: string[];
  observationScope?: Record<string, unknown>;
}

export async function handleFactAssert(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<FactAssertInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.fact.assert',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const factId = createFactId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'fact.asserted',
          commandName: 'investigation.fact.assert',
          actor: actorContext,
          payload: toJsonValue({
            factId,
            inquiryId: payload.inquiryId ?? null,
            statement: payload.statement,
            factKind: payload.factKind,
            polarity: payload.polarity,
            sourceArtifactIds: payload.sourceArtifactIds,
            aboutRefs: payload.aboutRefs ?? [],
            observationScope: payload.observationScope ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('facts', {
          id: factId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'active',
          payload: toJsonValue({
            id: factId,
            caseId: payload.caseId,
            inquiryId: payload.inquiryId ?? null,
            statement: payload.statement,
            factKind: payload.factKind,
            polarity: payload.polarity,
            status: 'active',
            sourceArtifactIds: payload.sourceArtifactIds,
            aboutRefs: payload.aboutRefs ?? [],
            observationScope: payload.observationScope ?? null
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [factId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}