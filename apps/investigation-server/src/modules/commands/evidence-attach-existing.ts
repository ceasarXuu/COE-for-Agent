import { createCommandResult, createEvidenceRefId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import {
  asValidatedInput,
  executeIdempotentMutation,
  requireActorContext,
  requireRecord,
  toJsonValue
} from './shared.js';
import { assertCanonicalChildUnderParent, requireCanonicalParent } from './canonical-shared.js';
import { assertEvidenceEffectMatchesParent } from './evidence-shared.js';

interface EvidenceAttachExistingInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  parentNodeId: string;
  evidenceId: string;
  effectOnParent: 'supports' | 'refutes' | 'neutral' | 'validates' | 'invalidates';
  interpretation: string;
  localConfidence?: number;
}

export async function handleEvidenceAttachExisting(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<EvidenceAttachExistingInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.evidence.attach_existing',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const parent = await requireCanonicalParent(trx, payload.caseId, payload.parentNodeId);
        assertCanonicalChildUnderParent(parent, 'evidence_ref');
        assertEvidenceEffectMatchesParent(parent.kind, payload.effectOnParent);
        await requireRecord(trx, 'evidence_pool', payload.evidenceId, payload.caseId);

        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const evidenceRefId = createEvidenceRefId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.evidence.attached',
          commandName: 'investigation.evidence.attach_existing',
          actor: actorContext,
          payload: toJsonValue({
            evidenceRefId,
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            evidenceId: payload.evidenceId,
            effectOnParent: payload.effectOnParent,
            interpretation: payload.interpretation,
            localConfidence: payload.localConfidence ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('evidence_refs', {
          id: evidenceRefId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: null,
          payload: toJsonValue({
            id: evidenceRefId,
            caseId: payload.caseId,
            canonicalKind: 'evidence_ref',
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            evidenceId: payload.evidenceId,
            effectOnParent: payload.effectOnParent,
            interpretation: payload.interpretation,
            localConfidence: payload.localConfidence ?? null
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [evidenceRefId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
