import { createCommandResult, createEvidenceId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface EvidenceCaptureInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  kind: 'log' | 'code' | 'trace' | 'reasoning' | 'experiment_result' | 'document' | 'other';
  title: string;
  summary?: string;
  contentRef?: string;
  provenance: string;
  confidence?: number;
}

export async function handleEvidenceCapture(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<EvidenceCaptureInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.evidence.capture',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const evidenceId = createEvidenceId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.evidence.captured',
          commandName: 'investigation.evidence.capture',
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
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('evidence_pool', {
          id: evidenceId,
          caseId: payload.caseId,
          revision: result.caseRevision,
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

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [evidenceId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
