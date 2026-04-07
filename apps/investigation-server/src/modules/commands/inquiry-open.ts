import { createCommandResult, createInquiryId } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface InquiryOpenInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  title: string;
  question: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  scopeRefs?: string[];
}

export async function handleInquiryOpen(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<InquiryOpenInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.inquiry.open',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const inquiryId = createInquiryId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'inquiry.opened',
          commandName: 'investigation.inquiry.open',
          actor: actorContext,
          payload: toJsonValue({
            inquiryId,
            title: payload.title,
            question: payload.question,
            priority: payload.priority,
            scopeRefs: payload.scopeRefs ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('inquiries', {
          id: inquiryId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          status: 'open',
          payload: toJsonValue({
            id: inquiryId,
            caseId: payload.caseId,
            title: payload.title,
            question: payload.question,
            priority: payload.priority,
            scopeRefs: payload.scopeRefs ?? [],
            status: 'open'
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [inquiryId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}