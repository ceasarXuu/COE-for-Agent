import { createCommandResult, createRepairAttemptId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  toJsonValue
} from './shared.js';
import { assertCanonicalChildUnderParent, requireCanonicalParent } from './canonical-shared.js';

interface RepairAttemptCreateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  parentNodeId: string;
  changeSummary: string;
  scope?: string;
  confidence?: number;
}

export async function handleRepairAttemptCreate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<RepairAttemptCreateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.repair_attempt.create',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const parent = await requireCanonicalParent(trx, payload.caseId, payload.parentNodeId);
        assertCanonicalChildUnderParent(parent, 'repair_attempt');

        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const repairAttemptId = createRepairAttemptId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.repair_attempt.created',
          commandName: 'investigation.repair_attempt.create',
          actor: actorContext,
          payload: toJsonValue({
            repairAttemptId,
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            changeSummary: payload.changeSummary,
            scope: payload.scope ?? null,
            confidence: payload.confidence ?? null,
            status: 'proposed'
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('repair_attempts', {
          id: repairAttemptId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'proposed',
          payload: toJsonValue({
            id: repairAttemptId,
            caseId: payload.caseId,
            canonicalKind: 'repair_attempt',
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            changeSummary: payload.changeSummary,
            scope: payload.scope ?? null,
            confidence: payload.confidence ?? null,
            status: 'proposed'
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [repairAttemptId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
