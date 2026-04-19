import { createCommandResult, createEvidenceId, createEvidenceRefId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';
import { requireCanonicalParent, assertCanonicalChildUnderParent } from './canonical-shared.js';
import { assertEvidenceEffectMatchesParent } from './evidence-shared.js';

interface EvidenceCaptureAndAttachInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  parentNodeId: string;
  kind: 'log' | 'code' | 'trace' | 'reasoning' | 'experiment_result' | 'document' | 'other';
  title: string;
  summary?: string;
  contentRef?: string;
  provenance: string;
  confidence?: number;
  effectOnParent: 'supports' | 'refutes' | 'neutral' | 'validates' | 'invalidates';
  interpretation: string;
  localConfidence?: number;
}

export async function handleEvidenceCaptureAndAttach(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<EvidenceCaptureAndAttachInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.evidence.capture_and_attach',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const parent = await requireCanonicalParent(trx, payload.caseId, payload.parentNodeId);
        assertCanonicalChildUnderParent(parent, 'evidence_ref');
        assertEvidenceEffectMatchesParent(parent.kind, payload.effectOnParent);

        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const evidenceId = createEvidenceId();
        const evidenceRefId = createEvidenceRefId();

        // Step 1: Capture evidence entity
        const captureResult = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.evidence.captured',
          commandName: 'investigation.evidence.capture_and_attach',
          actor: actorContext,
          payload: toJsonValue({
            evidenceId,
            kind: payload.kind,
            title: payload.title,
            summary: payload.summary ?? null,
            contentRef: payload.contentRef ?? null,
            provenance: payload.provenance,
            confidence: payload.confidence ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: `${payload.idempotencyKey}:capture` }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('evidence_pool', {
          id: evidenceId,
          caseId: payload.caseId,
          revision: captureResult.caseRevision,
          status: null,
          payload: toJsonValue({
            id: evidenceId,
            caseId: payload.caseId,
            canonicalKind: 'evidence',
            kind: payload.kind,
            title: payload.title,
            summary: payload.summary ?? null,
            contentRef: payload.contentRef ?? null,
            provenance: payload.provenance,
            confidence: payload.confidence ?? null
          })
        });

        // Step 2: Attach evidence ref (same transaction, sequential revision)
        const attachResult = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: captureResult.caseRevision,
          eventType: 'canonical.evidence.attached',
          commandName: 'investigation.evidence.capture_and_attach',
          actor: actorContext,
          payload: toJsonValue({
            evidenceRefId,
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            evidenceId,
            effectOnParent: payload.effectOnParent,
            interpretation: payload.interpretation,
            localConfidence: payload.localConfidence ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: `${payload.idempotencyKey}:attach` }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('evidence_refs', {
          id: evidenceRefId,
          caseId: payload.caseId,
          revision: attachResult.caseRevision,
          status: null,
          payload: toJsonValue({
            id: evidenceRefId,
            caseId: payload.caseId,
            canonicalKind: 'evidence_ref',
            parentNodeId: parent.id,
            parentNodeKind: parent.kind,
            evidenceId,
            effectOnParent: payload.effectOnParent,
            interpretation: payload.interpretation,
            localConfidence: payload.localConfidence ?? null
          })
        });

        return createCommandResult({
          ok: true,
          eventId: attachResult.eventId,
          createdIds: [evidenceId, evidenceRefId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: attachResult.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
