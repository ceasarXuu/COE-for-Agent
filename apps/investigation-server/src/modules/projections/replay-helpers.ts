import type {
  CaseStateRecord,
  CheckpointRecord,
  CurrentStateNodeRecord,
  StoredEvent
} from '@coe/persistence';

export const PROJECTION_TABLE_NAMES = [
  'problems',
  'blockers',
  'repair_attempts',
  'evidence_pool',
  'evidence_refs',
  'hypotheses'
] as const;

export type ProjectionTableName = typeof PROJECTION_TABLE_NAMES[number];

export const NODE_KIND_BY_TABLE: Record<ProjectionTableName, string> = {
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

export interface SerializedProjectedCaseState {
  projectionRevision: number;
  caseRecord: ProjectedCaseRecord | null;
  tables: Record<ProjectionTableName, ProjectedNodeRecord[]>;
}

export type StoredEventHandler = (
  state: ProjectedCaseState,
  event: StoredEvent,
  payload: Record<string, unknown>
) => void;

export function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
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

export function createEmptyProjectedCaseState(caseId: string, headRevision = 0): ProjectedCaseState {
  return {
    caseId,
    headRevision,
    projectionRevision: 0,
    caseRecord: null,
    tables: createTables()
  };
}

export function toProjectedCaseRecord(record: CaseStateRecord): ProjectedCaseRecord {
  return {
    id: record.id,
    title: record.title ?? null,
    severity: record.severity ?? null,
    status: record.status,
    revision: record.revision,
    payload: structuredClone(asObject(record.payload))
  };
}

export function toProjectedNodeRecord(
  tableName: ProjectionTableName,
  record: CurrentStateNodeRecord
): ProjectedNodeRecord {
  return {
    id: record.id,
    kind: NODE_KIND_BY_TABLE[tableName],
    caseId: record.caseId,
    revision: record.revision,
    status: record.status ?? null,
    payload: structuredClone(asObject(record.payload))
  };
}

export function upsertNode(
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

export function patchNode(
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

export function patchNodeStatus(
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

export function serializeState(state: ProjectedCaseState): SerializedProjectedCaseState {
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

export function restoreFromCheckpoint(
  caseId: string,
  headRevision: number,
  checkpoint: CheckpointRecord | undefined
): ProjectedCaseState | null {
  if (!checkpoint) {
    return null;
  }

  const projectionState = asObject(checkpoint.projectionState);
  const projectionRevision =
    typeof projectionState.projectionRevision === 'number' ? projectionState.projectionRevision : checkpoint.revision;
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
