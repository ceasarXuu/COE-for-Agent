import { createCommandResult, createHypothesisId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  toJsonValue
} from './shared.js';
import { assertCanonicalChildUnderParent, requireCanonicalParent } from './canonical-shared.js';

interface HypothesisCreateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  parentNodeId: string;
  title?: string;
  statement: string;
  falsificationCriteria: string[];
  derivedFromEvidenceIds?: string[];
}

export async function handleHypothesisCreate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<HypothesisCreateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.hypothesis.create',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const parent = await requireCanonicalParent(trx, payload.caseId, payload.parentNodeId);
        assertCanonicalChildUnderParent(parent, 'hypothesis');

        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const hypothesisId = createHypothesisId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.hypothesis.created',
          commandName: 'investigation.hypothesis.create',
          actor: actorContext,
          payload: toJsonValue({
            hypothesisId,
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            title: payload.title ?? null,
            statement: payload.statement,
            falsificationCriteria: payload.falsificationCriteria,
            derivedFromEvidenceIds: payload.derivedFromEvidenceIds ?? [],
            status: 'unverified'
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('hypotheses', {
          id: hypothesisId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'unverified',
          payload: toJsonValue({
            id: hypothesisId,
            caseId: payload.caseId,
            canonicalKind: 'hypothesis',
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            title: payload.title ?? payload.statement,
            statement: payload.statement,
            falsificationCriteria: payload.falsificationCriteria,
            derivedFromEvidenceIds: payload.derivedFromEvidenceIds ?? [],
            status: 'unverified'
          })
        });

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
