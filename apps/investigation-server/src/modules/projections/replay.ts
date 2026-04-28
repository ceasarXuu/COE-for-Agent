import {
  CheckpointRepository,
  CurrentStateRepository,
  EventStoreRepository,
  type CheckpointRecord,
  type StoredEvent
} from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';

import {
  PROJECTION_TABLE_NAMES,
  asObject,
  createEmptyProjectedCaseState,
  restoreFromCheckpoint,
  serializeState,
  toProjectedCaseRecord,
  toProjectedNodeRecord,
  type ProjectedCaseRecord,
  type ProjectedCaseState,
  type ProjectedNodeRecord,
  type ProjectionTableName
} from './replay-helpers.js';
import { STORED_EVENT_HANDLERS } from './replay-handlers.js';

export type {
  ProjectedCaseRecord,
  ProjectedCaseState,
  ProjectedNodeRecord,
  ProjectionTableName
};

function applyStoredEvent(state: ProjectedCaseState, event: StoredEvent): void {
  const payload = asObject(event.payload);

  STORED_EVENT_HANDLERS[event.eventType]?.(state, event, payload);
  state.projectionRevision = event.caseRevision;
}

export function listProjectedNodes(state: ProjectedCaseState): ProjectedNodeRecord[] {
  return PROJECTION_TABLE_NAMES.flatMap((tableName) => [...state.tables[tableName].values()]);
}

export function serializeProjectedCaseState(state: ProjectedCaseState): Record<string, unknown> {
  return serializeState(state) as unknown as Record<string, unknown>;
}

export async function loadProjectedCaseState(
  services: InvestigationServerServices,
  caseId: string,
  requestedRevision: number | null
): Promise<ProjectedCaseState> {
  const currentState = new CurrentStateRepository(services.db);
  const caseRecord = await currentState.getCase(caseId);
  const headRevision = caseRecord?.revision ?? 0;

  if (requestedRevision === null || requestedRevision >= headRevision) {
    const state = createEmptyProjectedCaseState(caseId, headRevision);
    state.projectionRevision = headRevision;
    state.caseRecord = caseRecord ? toProjectedCaseRecord(caseRecord) : null;

    for (const tableName of PROJECTION_TABLE_NAMES) {
      const records = await currentState.listRecordsByCase(tableName, caseId);
      for (const record of records) {
        const projected = toProjectedNodeRecord(tableName, record);
        state.tables[tableName].set(projected.id, projected);
      }
    }

    return state;
  }

  const targetRevision = Math.max(0, Math.min(requestedRevision, headRevision));
  const checkpoints = new CheckpointRepository(services.db);
  const checkpoint = restoreFromCheckpoint(caseId, headRevision, await checkpoints.loadNearest(caseId, targetRevision));
  const state = checkpoint ?? createEmptyProjectedCaseState(caseId, headRevision);
  const eventStore = new EventStoreRepository(services.db);
  const events = await eventStore.listForReplay({
    caseId,
    fromRevisionExclusive: state.projectionRevision,
    toRevisionInclusive: targetRevision
  });

  for (const event of events) {
    applyStoredEvent(state, event);
  }

  state.headRevision = headRevision;
  state.projectionRevision = targetRevision;
  if (state.caseRecord) {
    state.caseRecord.revision = targetRevision;
  }

  await checkpoints.save({
    caseId,
    revision: targetRevision,
    projectionState: serializeProjectedCaseState(state) as unknown as CheckpointRecord['projectionState']
  });

  return state;
}
