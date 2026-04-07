import { EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';

export interface CloudEventEnvelope {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject: string;
  time: string;
  dataschema: string;
  data: unknown;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function buildEventExport(services: InvestigationServerServices, caseId: string) {
  const events = await new EventStoreRepository(services.db).listCaseEvents(caseId);

  return {
    caseId,
    exportedAt: new Date().toISOString(),
    events: events.map((event) => ({
      specversion: '1.0',
      id: event.eventId,
      source: `/cases/${caseId}/events`,
      type: event.eventType,
      subject: caseId,
      time: event.createdAt.toISOString(),
      dataschema: `https://schemas.coe.local/events/v1/${event.eventType}.data.schema.json`,
      data: {
        eventId: event.eventId,
        caseId: event.caseId,
        caseRevision: event.caseRevision,
        ...asObject(event.payload)
      }
    } satisfies CloudEventEnvelope))
  };
}