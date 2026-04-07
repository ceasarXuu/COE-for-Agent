import { EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';
import { loadProjectedCaseState } from '../projections/replay.js';

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];
}

export interface ProvExportPackage {
  caseId: string;
  generatedAt: string;
  entities: Array<{
    id: string;
    kind: string;
    label: string;
  }>;
  activities: Array<{
    activityId: string;
    activityType: string;
    caseRevision: number;
    occurredAt: string;
  }>;
  relations: {
    used: Array<{
      activityId: string;
      activityType: string;
      entityId: string;
    }>;
    wasGeneratedBy: Array<{
      entityId: string;
      activityId: string;
      activityType: string;
    }>;
    wasAssociatedWith: Array<{
      activityId: string;
      actorId: string;
      actorType: string;
    }>;
    wasDerivedFrom: Array<{
      generatedEntityId: string;
      usedEntityId: string;
    }>;
  };
}

function generatedEntityIds(eventType: string, payload: Record<string, unknown>, caseId: string): string[] {
  switch (eventType) {
    case 'case.opened':
      return [asString(payload.caseId) ?? caseId, ...asString(payload.defaultInquiryId) ? [asString(payload.defaultInquiryId)!] : []];
    case 'inquiry.opened':
      return asString(payload.inquiryId) ? [asString(payload.inquiryId)!] : [];
    case 'entity.registered':
      return asString(payload.entityId) ? [asString(payload.entityId)!] : [];
    case 'symptom.reported':
      return asString(payload.symptomId) ? [asString(payload.symptomId)!] : [];
    case 'artifact.attached':
      return asString(payload.artifactId) ? [asString(payload.artifactId)!] : [];
    case 'fact.asserted':
      return asString(payload.factId) ? [asString(payload.factId)!] : [];
    case 'hypothesis.proposed':
      return asString(payload.hypothesisId) ? [asString(payload.hypothesisId)!] : [];
    case 'experiment.planned':
      return asString(payload.experimentId) ? [asString(payload.experimentId)!] : [];
    case 'gap.opened':
      return asString(payload.gapId) ? [asString(payload.gapId)!] : [];
    case 'residual.opened':
      return asString(payload.residualId) ? [asString(payload.residualId)!] : [];
    case 'decision.recorded':
      return asString(payload.decisionId) ? [asString(payload.decisionId)!] : [];
    default:
      return [];
  }
}

function usedEntityIds(eventType: string, payload: Record<string, unknown>): string[] {
  switch (eventType) {
    case 'fact.asserted':
      return [...asStringArray(payload.sourceArtifactIds), ...asStringArray(payload.aboutRefs)];
    case 'hypothesis.proposed':
      return [...asStringArray(payload.explainsSymptomIds), ...asStringArray(payload.dependsOnFactIds)];
    case 'experiment.planned':
      return asStringArray(payload.testsHypothesisIds);
    case 'experiment.result_recorded':
      return [asString(payload.experimentId), ...asStringArray(payload.producedArtifactIds), ...asStringArray(payload.producedFactIds)].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      );
    case 'gap.resolve':
      return [asString(payload.gapId), ...asStringArray(payload.resolutionFactIds), ...asStringArray(payload.resolutionExperimentIds)].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      );
    case 'residual.updated':
      return [asString(payload.residualId), ...asStringArray(payload.reasonFactIds), ...asStringArray(payload.reasonHypothesisIds)].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      );
    case 'decision.recorded':
      return [
        asString(payload.inquiryId),
        ...asStringArray(payload.supportingFactIds),
        ...asStringArray(payload.supportingExperimentIds),
        ...asStringArray(payload.supportingHypothesisIds)
      ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    default:
      return [];
  }
}

export async function buildProvExport(
  services: InvestigationServerServices,
  caseId: string
): Promise<ProvExportPackage> {
  const [projectionState, events] = await Promise.all([
    loadProjectedCaseState(services, caseId, null),
    new EventStoreRepository(services.db).listCaseEvents(caseId)
  ]);

  const entities = [
    projectionState.caseRecord
      ? {
          id: projectionState.caseRecord.id,
          kind: 'case',
          label: projectionState.caseRecord.title ?? projectionState.caseRecord.id
        }
      : null,
    ...Object.values(projectionState.tables).flatMap((records) => [...records.values()].map((record) => {
      const payload = asObject(record.payload);
      return {
        id: record.id,
        kind: record.kind,
        label: asString(payload.title) ?? asString(payload.name) ?? asString(payload.statement) ?? asString(payload.question) ?? record.id
      };
    }))
  ].filter((value): value is { id: string; kind: string; label: string } => value !== null);

  const used: ProvExportPackage['relations']['used'] = [];
  const wasGeneratedBy: ProvExportPackage['relations']['wasGeneratedBy'] = [];
  const wasAssociatedWith: ProvExportPackage['relations']['wasAssociatedWith'] = [];
  const wasDerivedFrom: ProvExportPackage['relations']['wasDerivedFrom'] = [];

  for (const event of events) {
    const payload = asObject(event.payload);
    const eventType = event.eventType;

    for (const entityId of generatedEntityIds(eventType, payload, caseId)) {
      wasGeneratedBy.push({
        entityId,
        activityId: event.eventId,
        activityType: eventType
      });
    }

    const usedIds = usedEntityIds(eventType, payload);
    for (const entityId of usedIds) {
      used.push({
        activityId: event.eventId,
        activityType: eventType,
        entityId
      });
    }

    for (const generatedEntityId of generatedEntityIds(eventType, payload, caseId)) {
      for (const usedEntityId of usedIds) {
        wasDerivedFrom.push({
          generatedEntityId,
          usedEntityId
        });
      }
    }

    const actor = asObject(event.actor);
    const actorId = asString(actor.actorId);
    const actorType = asString(actor.actorType);
    if (actorId && actorType) {
      wasAssociatedWith.push({
        activityId: event.eventId,
        actorId,
        actorType
      });
    }
  }

  return {
    caseId,
    generatedAt: new Date().toISOString(),
    entities,
    activities: events.map((event) => ({
      activityId: event.eventId,
      activityType: event.eventType,
      caseRevision: event.caseRevision,
      occurredAt: event.createdAt.toISOString()
    })),
    relations: {
      used,
      wasGeneratedBy,
      wasAssociatedWith,
      wasDerivedFrom
    }
  };
}