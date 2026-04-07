import { createCommandResult, createEntityId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface EntityRegisterInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  entityKind: string;
  name: string;
  locator: Record<string, unknown>;
}

export async function handleEntityRegister(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<EntityRegisterInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.entity.register',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const entityId = createEntityId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'entity.registered',
          commandName: 'investigation.entity.register',
          actor: actorContext,
          payload: toJsonValue({
            entityId,
            entityKind: payload.entityKind,
            name: payload.name,
            locator: payload.locator
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('entities', {
          id: entityId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          payload: toJsonValue({
            id: entityId,
            caseId: payload.caseId,
            entityKind: payload.entityKind,
            name: payload.name,
            locator: payload.locator
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [entityId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}