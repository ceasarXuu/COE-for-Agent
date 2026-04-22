import {
  CheckpointRepository,
  CurrentStateRepository,
  EventStoreRepository,
  type CaseStateRecord,
  type CheckpointRecord,
  type CurrentStateNodeRecord,
  type StoredEvent
} from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';

const PROJECTION_TABLE_NAMES = [
  'problems',
  'blockers',
  'repair_attempts',
  'evidence_pool',
  'evidence_refs',
  'hypotheses'
] as const;

export type ProjectionTableName = typeof PROJECTION_TABLE_NAMES[number];

const NODE_KIND_BY_TABLE: Record<ProjectionTableName, string> = {
  problems: 'problem',
  blockers: 'blocker',
  repair_attempts: 'repair_attempt',
  evidence_pool: 'evidence',
  evidence_refs: 'evidence_ref',
  hypotheses: 'hypothesis'
};

export interface ProjectedNodeRecord {
  id: string;
  kind: string;
  caseId: string;
  revision: number;
  status: string | null;
  payload: Record<string, unknown>;
}

export interface ProjectedCaseRecord {
  id: string;
  title: string | null;
  severity: string | null;
  status: string;
  revision: number;
  payload: Record<string, unknown>;
}

export interface ProjectedCaseState {
  caseId: string;
  headRevision: number;
  projectionRevision: number;
  caseRecord: ProjectedCaseRecord | null;
  tables: { [K in ProjectionTableName]: Map<string, ProjectedNodeRecord> };
}

interface SerializedProjectedCaseState {
  projectionRevision: number;
  caseRecord: ProjectedCaseRecord | null;
  tables: Record<ProjectionTableName, ProjectedNodeRecord[]>;
}

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

function createTables(): ProjectedCaseState['tables'] {
  return {
    problems: new Map(),
    blockers: new Map(),
    repair_attempts: new Map(),
    evidence_pool: new Map(),
    evidence_refs: new Map(),
    hypotheses: new Map()
  };
}

function createEmptyProjectedCaseState(caseId: string, headRevision = 0): ProjectedCaseState {
  return {
    caseId,
    headRevision,
    projectionRevision: 0,
    caseRecord: null,
    tables: createTables()
  };
}

function toProjectedCaseRecord(record: CaseStateRecord): ProjectedCaseRecord {
  return {
    id: record.id,
    title: record.title ?? null,
    severity: record.severity ?? null,
    status: record.status,
    revision: record.revision,
    payload: structuredClone(asObject(record.payload))
  };
}

function toProjectedNodeRecord(tableName: ProjectionTableName, record: CurrentStateNodeRecord): ProjectedNodeRecord {
  return {
    id: record.id,
    kind: NODE_KIND_BY_TABLE[tableName],
    caseId: record.caseId,
    revision: record.revision,
    status: record.status ?? null,
    payload: structuredClone(asObject(record.payload))
  };
}

function upsertNode(
  state: ProjectedCaseState,
  tableName: ProjectionTableName,
  id: string,
  revision: number,
  payload: Record<string, unknown>,
  status: string | null = null
): void {
  state.tables[tableName].set(id, {
    id,
    kind: NODE_KIND_BY_TABLE[tableName],
    caseId: state.caseId,
    revision,
    status,
    payload: structuredClone(payload)
  });
}

function patchNode(
  state: ProjectedCaseState,
  tableName: ProjectionTableName,
  id: string,
  revision: number,
  patch: Record<string, unknown>,
  status?: string | null
): void {
  const current = state.tables[tableName].get(id);
  const nextPayload = {
    id,
    caseId: state.caseId,
    ...(current?.payload ?? {}),
    ...patch
  };

  state.tables[tableName].set(id, {
    id,
    kind: NODE_KIND_BY_TABLE[tableName],
    caseId: state.caseId,
    revision,
    status: status ?? current?.status ?? null,
    payload: structuredClone(nextPayload)
  });
}

function serializeState(state: ProjectedCaseState): SerializedProjectedCaseState {
  return {
    projectionRevision: state.projectionRevision,
    caseRecord: state.caseRecord ? structuredClone(state.caseRecord) : null,
    tables: {
      problems: [...state.tables.problems.values()].map((record) => structuredClone(record)),
      blockers: [...state.tables.blockers.values()].map((record) => structuredClone(record)),
      repair_attempts: [...state.tables.repair_attempts.values()].map((record) => structuredClone(record)),
      evidence_pool: [...state.tables.evidence_pool.values()].map((record) => structuredClone(record)),
      evidence_refs: [...state.tables.evidence_refs.values()].map((record) => structuredClone(record)),
      hypotheses: [...state.tables.hypotheses.values()].map((record) => structuredClone(record))
    }
  };
}

function restoreFromCheckpoint(caseId: string, headRevision: number, checkpoint: CheckpointRecord | undefined): ProjectedCaseState | null {
  if (!checkpoint) {
    return null;
  }

  const projectionState = asObject(checkpoint.projectionState);
  const projectionRevision = typeof projectionState.projectionRevision === 'number' ? projectionState.projectionRevision : checkpoint.revision;
  const state = createEmptyProjectedCaseState(caseId, headRevision);
  state.projectionRevision = projectionRevision;

  const caseRecord = projectionState.caseRecord;
  if (typeof caseRecord === 'object' && caseRecord !== null && !Array.isArray(caseRecord)) {
    const record = caseRecord as Record<string, unknown>;
    const status = asString(record.status);
    if (status) {
      state.caseRecord = {
        id: asString(record.id) ?? caseId,
        title: asString(record.title) ?? null,
        severity: asString(record.severity) ?? null,
        status,
        revision: typeof record.revision === 'number' ? record.revision : projectionRevision,
        payload: structuredClone(asObject(record.payload))
      };
    }
  }

  const tables = asObject(projectionState.tables);
  for (const tableName of PROJECTION_TABLE_NAMES) {
    const rows = tables[tableName];
    if (!Array.isArray(rows)) {
      continue;
    }

    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        continue;
      }

      const record = row as Record<string, unknown>;
      const id = asString(record.id);
      if (!id) {
        continue;
      }

      upsertNode(
        state,
        tableName,
        id,
        typeof record.revision === 'number' ? record.revision : projectionRevision,
        structuredClone(asObject(record.payload)),
        asString(record.status) ?? null
      );
    }
  }

  return state;
}

type StoredEventHandler = (state: ProjectedCaseState, event: StoredEvent, payload: Record<string, unknown>) => void;

function patchNodeStatus(
  state: ProjectedCaseState,
  tableName: ProjectionTableName,
  id: string | undefined,
  revision: number,
  nextStatus: string | undefined
): void {
  if (id && nextStatus) {
    patchNode(state, tableName, id, revision, { status: nextStatus }, nextStatus);
  }
}

const STORED_EVENT_HANDLERS: Record<string, StoredEventHandler> = {
  'case.opened': (state, event, payload) => {
    const caseId = asString(payload.caseId) ?? state.caseId;
    const title = asString(payload.title) ?? null;
    const objective = asString(payload.objective) ?? null;
    const severity = asString(payload.severity) ?? null;
    const defaultProblemId = asString(payload.defaultProblemId);

    state.caseRecord = {
      id: caseId,
      title,
      severity,
      status: 'active',
      revision: event.caseRevision,
      payload: {
        id: caseId,
        title,
        objective,
        severity,
        defaultProblemId: defaultProblemId ?? null,
        status: 'active'
      }
    };

    if (defaultProblemId) {
      upsertNode(state, 'problems', defaultProblemId, event.caseRevision, {
        id: defaultProblemId,
        caseId,
        title,
        description: objective,
        environment: '',
        symptoms: [],
        resolutionCriteria: [],
        referenceMaterials: [],
        status: 'open'
      }, 'open');
    }
  },
  'case.stage_advanced': (state, event, payload) => {
    const status = asString(payload.status) ?? state.caseRecord?.status ?? 'active';
    if (state.caseRecord) {
      state.caseRecord = {
        ...state.caseRecord,
        status,
        revision: event.caseRevision,
        payload: {
          ...state.caseRecord.payload,
          status,
          reason: payload.reason ?? null
        }
      };
    }
  },
  'case.closed': (state, event, payload) => {
    const status = asString(payload.status) ?? 'closed';
    if (state.caseRecord) {
      state.caseRecord = {
        ...state.caseRecord,
        status,
        revision: event.caseRevision,
        payload: {
          ...state.caseRecord.payload,
          status,
          reason: payload.reason ?? null
        }
      };
    }
  },
  'problem.updated': (state, event, payload) => {
    const problemId = asString(payload.problemId);
    if (problemId) {
      patchNode(state, 'problems', problemId, event.caseRevision, {
        ...(payload.title !== null && payload.title !== undefined ? { title: asString(payload.title) ?? null } : {}),
        ...(payload.description !== null && payload.description !== undefined ? { description: asString(payload.description) ?? null } : {}),
        ...(payload.environment !== null && payload.environment !== undefined ? { environment: asString(payload.environment) ?? null } : {}),
        ...(Array.isArray(payload.symptoms) ? { symptoms: asStringArray(payload.symptoms) } : {}),
        ...(Array.isArray(payload.resolutionCriteria) ? { resolutionCriteria: asStringArray(payload.resolutionCriteria) } : {})
      });
    }
  },
  'problem.status_updated': (state, event, payload) => {
    patchNodeStatus(state, 'problems', asString(payload.problemId), event.caseRevision, asString(payload.newStatus));
  },
  'problem.reference_material_added': (state, event, payload) => {
    const problemId = asString(payload.problemId);
    if (problemId) {
      const current = state.tables.problems.get(problemId);
      const currentPayload = current?.payload ?? {};
      const nextMaterial = {
        materialId: asString(payload.materialId) ?? '',
        kind: asString(payload.materialKind) ?? 'other',
        title: asString(payload.title) ?? '',
        contentRef: payload.contentRef ?? null,
        note: payload.note ?? null
      };
      const currentMaterials = Array.isArray(currentPayload.referenceMaterials) ? currentPayload.referenceMaterials : [];
      patchNode(state, 'problems', problemId, event.caseRevision, {
        referenceMaterials: [...currentMaterials, nextMaterial]
      });
    }
  },
  'canonical.hypothesis.created': (state, event, payload) => {
    const hypothesisId = asString(payload.hypothesisId);
    if (hypothesisId) {
      upsertNode(state, 'hypotheses', hypothesisId, event.caseRevision, {
        id: hypothesisId,
        caseId: state.caseId,
        canonicalKind: 'hypothesis',
        parentNodeId: asString(payload.parentNodeId) ?? null,
        parentNodeKind: asString(payload.parentNodeKind) ?? null,
        title: asString(payload.title) ?? asString(payload.statement) ?? null,
        statement: asString(payload.statement) ?? null,
        falsificationCriteria: asStringArray(payload.falsificationCriteria),
        derivedFromEvidenceIds: asStringArray(payload.derivedFromEvidenceIds),
        status: 'unverified'
      }, 'unverified');
    }
  },
  'canonical.hypothesis.status_updated': (state, event, payload) => {
    patchNodeStatus(state, 'hypotheses', asString(payload.hypothesisId), event.caseRevision, asString(payload.newStatus));
  },
  'canonical.hypothesis.updated': (state, event, payload) => {
    const hypothesisId = asString(payload.hypothesisId);
    if (hypothesisId) {
      patchNode(state, 'hypotheses', hypothesisId, event.caseRevision, {
        ...(payload.title !== null && payload.title !== undefined ? { title: asString(payload.title) ?? null } : {}),
        ...(payload.statement !== null && payload.statement !== undefined ? { statement: asString(payload.statement) ?? null } : {}),
        ...(Array.isArray(payload.falsificationCriteria) ? { falsificationCriteria: asStringArray(payload.falsificationCriteria) } : {})
      });
    }
  },
  'canonical.blocker.opened': (state, event, payload) => {
    const blockerId = asString(payload.blockerId);
    if (blockerId) {
      upsertNode(state, 'blockers', blockerId, event.caseRevision, {
        id: blockerId,
        caseId: state.caseId,
        canonicalKind: 'blocker',
        parentNodeId: asString(payload.hypothesisId) ?? null,
        parentNodeKind: 'hypothesis',
        description: asString(payload.description) ?? null,
        possibleWorkarounds: asStringArray(payload.possibleWorkarounds),
        status: 'active'
      }, 'active');
    }
  },
  'canonical.blocker.closed': (state, event, payload) => {
    patchNodeStatus(state, 'blockers', asString(payload.blockerId), event.caseRevision, asString(payload.newStatus));
  },
  'canonical.blocker.updated': (state, event, payload) => {
    const blockerId = asString(payload.blockerId);
    if (blockerId) {
      patchNode(state, 'blockers', blockerId, event.caseRevision, {
        ...(payload.description !== null && payload.description !== undefined ? { description: asString(payload.description) ?? null } : {}),
        ...(Array.isArray(payload.possibleWorkarounds) ? { possibleWorkarounds: asStringArray(payload.possibleWorkarounds) } : {})
      });
    }
  },
  'canonical.repair_attempt.created': (state, event, payload) => {
    const repairAttemptId = asString(payload.repairAttemptId);
    if (repairAttemptId) {
      upsertNode(state, 'repair_attempts', repairAttemptId, event.caseRevision, {
        id: repairAttemptId,
        caseId: state.caseId,
        canonicalKind: 'repair_attempt',
        parentNodeId: asString(payload.parentNodeId) ?? null,
        parentNodeKind: asString(payload.parentNodeKind) ?? null,
        changeSummary: asString(payload.changeSummary) ?? null,
        scope: asString(payload.scope) ?? null,
        confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
        status: 'proposed'
      }, 'proposed');
    }
  },
  'canonical.repair_attempt.status_updated': (state, event, payload) => {
    patchNodeStatus(state, 'repair_attempts', asString(payload.repairAttemptId), event.caseRevision, asString(payload.newStatus));
  },
  'canonical.repair_attempt.updated': (state, event, payload) => {
    const repairAttemptId = asString(payload.repairAttemptId);
    if (repairAttemptId) {
      patchNode(state, 'repair_attempts', repairAttemptId, event.caseRevision, {
        ...(payload.changeSummary !== null && payload.changeSummary !== undefined ? { changeSummary: asString(payload.changeSummary) ?? null } : {}),
        ...(payload.scope !== null && payload.scope !== undefined ? { scope: asString(payload.scope) ?? null } : {})
      });
    }
  },
  'canonical.evidence.captured': (state, event, payload) => {
    const evidenceId = asString(payload.evidenceId);
    if (evidenceId) {
      upsertNode(state, 'evidence_pool', evidenceId, event.caseRevision, {
        id: evidenceId,
        caseId: state.caseId,
        canonicalKind: 'evidence',
        kind: asString(payload.kind) ?? 'other',
        title: asString(payload.title) ?? null,
        summary: asString(payload.summary) ?? null,
        contentRef: payload.contentRef ?? null,
        provenance: asString(payload.provenance) ?? null,
        confidence: typeof payload.confidence === 'number' ? payload.confidence : null
      });
    }
  },
  'canonical.evidence.attached': (state, event, payload) => {
    const evidenceRefId = asString(payload.evidenceRefId);
    if (evidenceRefId) {
      upsertNode(state, 'evidence_refs', evidenceRefId, event.caseRevision, {
        id: evidenceRefId,
        caseId: state.caseId,
        canonicalKind: 'evidence_ref',
        parentNodeId: asString(payload.parentNodeId) ?? null,
        parentNodeKind: asString(payload.parentNodeKind) ?? null,
        evidenceId: asString(payload.evidenceId) ?? null,
        effectOnParent: asString(payload.effectOnParent) ?? null,
        interpretation: asString(payload.interpretation) ?? null,
        localConfidence: typeof payload.localConfidence === 'number' ? payload.localConfidence : null
      });
    }
  },
  'canonical.evidence_ref.updated': (state, event, payload) => {
    const evidenceRefId = asString(payload.evidenceRefId);
    if (evidenceRefId) {
      patchNode(state, 'evidence_refs', evidenceRefId, event.caseRevision, {
        ...(payload.effectOnParent !== null && payload.effectOnParent !== undefined ? { effectOnParent: asString(payload.effectOnParent) ?? null } : {}),
        ...(payload.interpretation !== null && payload.interpretation !== undefined ? { interpretation: asString(payload.interpretation) ?? null } : {})
      });
    }

    const evidenceId = asString(payload.evidenceId);
    if (evidenceId) {
      patchNode(state, 'evidence_pool', evidenceId, event.caseRevision, {
        ...(payload.title !== null && payload.title !== undefined ? { title: asString(payload.title) ?? null } : {}),
        ...(payload.summary !== null && payload.summary !== undefined ? { summary: asString(payload.summary) ?? null } : {}),
        ...(payload.provenance !== null && payload.provenance !== undefined ? { provenance: asString(payload.provenance) ?? null } : {})
      });
    }
  }
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
