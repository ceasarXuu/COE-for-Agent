import { createArtifactId, createCommandResult } from '@coe/domain';
import { CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface ArtifactAttachInput {
  idempotencyKey: string;
  caseId: string;
  ifCaseRevision: number;
  artifactKind: string;
  title: string;
  source: {
    uri: string;
    externalRef?: string;
  };
  contentRef?: string;
  excerpt?: string;
  aboutRefs?: string[];
}

export async function handleArtifactAttach(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<ArtifactAttachInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.artifact.attach',
        caseId: payload.caseId,
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const artifactId = createArtifactId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId: payload.caseId,
          expectedRevision: payload.ifCaseRevision,
          eventType: 'artifact.attached',
          commandName: 'investigation.artifact.attach',
          actor: actorContext,
          payload: toJsonValue({
            artifactId,
            artifactKind: payload.artifactKind,
            title: payload.title,
            source: payload.source,
            contentRef: payload.contentRef ?? null,
            excerpt: payload.excerpt ?? null,
            aboutRefs: payload.aboutRefs ?? []
          }),
          metadata: toJsonValue({ idempotencyKey: payload.idempotencyKey }) as { idempotencyKey: string }
        });

        await currentState.upsertRecord('artifacts', {
          id: artifactId,
          caseId: payload.caseId,
          revision: result.caseRevision,
          payload: toJsonValue({
            id: artifactId,
            caseId: payload.caseId,
            artifactKind: payload.artifactKind,
            title: payload.title,
            source: payload.source,
            contentRef: payload.contentRef ?? null,
            excerpt: payload.excerpt ?? null,
            aboutRefs: payload.aboutRefs ?? []
          })
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [artifactId],
          headRevisionBefore: payload.ifCaseRevision,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
