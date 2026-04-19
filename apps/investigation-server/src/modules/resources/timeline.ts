import { createResourceEnvelope } from '@coe/domain';
import { EventStoreRepository, CurrentStateRepository } from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';
import { getCaseIdFromUrl, parseRequestedRevision } from './shared.js';

export async function readTimelineResource(services: InvestigationServerServices, url: URL) {
  const caseId = getCaseIdFromUrl(url);
  const requestedRevision = parseRequestedRevision(url);
  const currentState = new CurrentStateRepository(services.db);
  const caseRecord = await currentState.getCase(caseId);
  const eventStore = new EventStoreRepository(services.db);
  const events = await eventStore.listCaseEvents(caseId, requestedRevision ?? undefined);
  const headRevision = caseRecord?.revision ?? 0;
  const projectionRevision = requestedRevision ?? headRevision;

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision,
      projectionRevision,
      requestedRevision,
      data: {
        events: events.map((event) => ({
          eventId: event.eventId,
          eventType: event.eventType,
          caseRevision: event.caseRevision,
          occurredAt: event.createdAt.toISOString(),
          editorOrigin: classifyEditorOrigin(event.actor),
          summary: event.eventType
        }))
      }
    })
  };
}

function classifyEditorOrigin(actor: unknown): 'agent' | 'web_ui' {
  const actorRecord = typeof actor === 'object' && actor !== null && !Array.isArray(actor)
    ? actor as Record<string, unknown>
    : {};

  return actorRecord.actorType === 'user' ? 'web_ui' : 'agent';
}
