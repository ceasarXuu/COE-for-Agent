import { closeInquiry, createCommandResult } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asJsonObject, asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface InquiryCloseInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  inquiryId: string;
  resolutionKind: 'answered' | 'superseded' | 'invalid' | 'merged';
  reason?: string;
}

export async function handleInquiryClose(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<InquiryCloseInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.inquiry.close',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const currentState = new CurrentStateRepository(trx);
        const eventStore = new EventStoreRepository(trx);
        const inquiry = await currentState.getRecord('inquiries', payload.inquiryId);

        if (!inquiry || inquiry.caseId !== payload.caseId) {
          throw new Error(`Inquiry not found: ${payload.inquiryId}`);
        }

        const nextState = closeInquiry({ status: (inquiry.status ?? 'open') as 'open' | 'paused' | 'closed' | 'merged' }, payload.resolutionKind);
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'inquiry.closed',
          commandName: 'investigation.inquiry.close',
          actor: actorContext,
          payload: toJsonValue({
            inquiryId: payload.inquiryId,
            resolutionKind: payload.resolutionKind,
            reason: payload.reason ?? null
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('inquiries', {
          id: payload.inquiryId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: nextState.status,
          payload: toJsonValue({
            ...asJsonObject(inquiry.payload),
            status: nextState.status,
            resolutionKind: nextState.resolutionKind,
            reason: payload.reason ?? null
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          updatedIds: [payload.inquiryId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}