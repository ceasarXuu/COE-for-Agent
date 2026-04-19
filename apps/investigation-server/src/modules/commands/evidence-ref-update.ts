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
import { recordPayload, stringValue } from '../shared/record-helpers.js';

interface EvidenceRefUpdateInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  evidenceRefId: string;
  title?: string;
  summary?: string;
  provenance?: string;
  effectOnParent?: 'supports' | 'refutes' | 'neutral' | 'validates' | 'invalidates';
  interpretation?: string;
}

export async function handleEvidenceRefUpdate(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<EvidenceRefUpdateInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.evidence_ref.update',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const evidenceRefRecord = await requireRecord(trx, 'evidence_refs', payload.evidenceRefId, payload.caseId);
        const currentRefPayload = recordPayload(evidenceRefRecord);
        const evidenceId = stringValue(currentRefPayload.evidenceId);
        const evidencePoolRecord = evidenceId ? await requireRecord(trx, 'evidence_pool', evidenceId, payload.caseId) : null;
        const currentEvidencePayload = recordPayload(evidencePoolRecord);

        const nextRefPayload = {
          ...currentRefPayload,
          ...(payload.effectOnParent ? { effectOnParent: payload.effectOnParent } : {}),
          ...(payload.interpretation ? { interpretation: payload.interpretation } : {})
        };

        const nextEvidencePayload = {
          ...currentEvidencePayload,
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.summary ? { summary: payload.summary } : {}),
          ...(payload.provenance ? { provenance: payload.provenance } : {})
        };

        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'canonical.evidence_ref.updated',
          commandName: 'investigation.evidence_ref.update',
          actor: actorContext,
          payload: toJsonValue({
            evidenceRefId: payload.evidenceRefId,
            evidenceId: evidenceId ?? null,
            title: payload.title ?? null,
            summary: payload.summary ?? null,
            provenance: payload.provenance ?? null,
            effectOnParent: payload.effectOnParent ?? null,
            interpretation: payload.interpretation ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('evidence_refs', {
          id: payload.evidenceRefId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: evidenceRefRecord.status ?? null,
          payload: toJsonValue(nextRefPayload)
        });

        if (evidenceId && evidencePoolRecord) {
          await currentState.upsertRecord('evidence_pool', {
            id: evidenceId,
            caseId: payload.caseId,
            revision: result.caseRevision,
            status: evidencePoolRecord.status ?? null,
            payload: toJsonValue(nextEvidencePayload)
          });
        }

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.evidenceRefId, ...(evidenceId ? [evidenceId] : [])],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
