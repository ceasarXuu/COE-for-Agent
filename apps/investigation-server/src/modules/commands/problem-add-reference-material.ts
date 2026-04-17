import { createCommandResult, createReferenceMaterialId } from '@coe/domain';
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

interface ProblemAddReferenceMaterialInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  problemId: string;
  materialKind: 'log' | 'code' | 'trace' | 'screenshot' | 'conversation' | 'ticket' | 'document' | 'other';
  title: string;
  contentRef?: string;
  note?: string;
}

export async function handleProblemAddReferenceMaterial(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ProblemAddReferenceMaterialInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.problem.add_reference_material',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const problemRecord = await requireRecord(trx, 'problems', payload.problemId, payload.caseId);
        const currentPayload = recordPayload(problemRecord);
        const materialId = createReferenceMaterialId();
        const nextMaterial = {
          materialId,
          kind: payload.materialKind,
          title: payload.title,
          contentRef: payload.contentRef ?? null,
          note: payload.note ?? null
        };
        const referenceMaterials = Array.isArray(currentPayload.referenceMaterials)
          ? [...currentPayload.referenceMaterials, nextMaterial]
          : [nextMaterial];

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'problem.reference_material_added',
          commandName: 'investigation.problem.add_reference_material',
          actor: actorContext,
          payload: toJsonValue({
            problemId: payload.problemId,
            materialId,
            materialKind: payload.materialKind,
            title: payload.title,
            contentRef: payload.contentRef ?? null,
            note: payload.note ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('problems', {
          id: payload.problemId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: problemRecord.status ?? null,
          payload: toJsonValue({
            ...currentPayload,
            referenceMaterials
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [materialId],
          updatedIds: [payload.problemId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
