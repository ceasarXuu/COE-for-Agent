import { createBlockerId, createCommandResult } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  toJsonValue
} from './shared.js';
import { requireCanonicalParent, assertCanonicalChildUnderParent } from './canonical-shared.js';

interface BlockerOpenInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  hypothesisId: string;
  description: string;
  possibleWorkarounds?: string[];
}

export async function handleBlockerOpen(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<BlockerOpenInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.blocker.open',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const parent = await requireCanonicalParent(trx, payload.caseId, payload.hypothesisId);
        assertCanonicalChildUnderParent(parent, 'blocker');

        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const blockerId = createBlockerId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.blocker.opened',
          commandName: 'investigation.blocker.open',
          actor: actorContext,
          payload: toJsonValue({
            blockerId,
            hypothesisId: payload.hypothesisId,
            description: payload.description,
            possibleWorkarounds: payload.possibleWorkarounds ?? [],
            status: 'active'
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('blockers', {
          id: blockerId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'active',
          payload: toJsonValue({
            id: blockerId,
            caseId: payload.caseId,
            canonicalKind: 'blocker',
            parentNodeId: payload.hypothesisId,
            parentNodeKind: 'hypothesis',
            description: payload.description,
            possibleWorkarounds: payload.possibleWorkarounds ?? [],
            status: 'active'
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [blockerId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
