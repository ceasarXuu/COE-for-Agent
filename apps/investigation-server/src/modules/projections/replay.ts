import {
  CheckpointRepository,
  CurrentStateRepository,
  EventStoreRepository,
  type CaseStateRecord,
  type CheckpointRecord,
  type CurrentStateNodeRecord,
  type CurrentStateTableName,
  type StoredEvent
} from '@coe/persistence';

import type { InvestigationServerServices } from '../../services.js';

const PROJECTION_TABLE_NAMES = [
  'problems',
  'blockers',
  'repair_attempts',
  'evidence_refs',
  'inquiries',
  'entities',
  'symptoms',
  'artifacts',
  'facts',
  'hypotheses',
  'experiments',
  'gaps',
  'residuals',
  'decisions'
] as const satisfies readonly CurrentStateTableName[];

const NODE_KIND_BY_TABLE: Record<CurrentStateTableName, string> = {
  problems: 'problem',
  blockers: 'blocker',
  repair_attempts: 'repair_attempt',
  evidence_pool: 'evidence',
  evidence_refs: 'evidence_ref',
  inquiries: 'inquiry',
  entities: 'entity',
  symptoms: 'symptom',
  artifacts: 'artifact',
  facts: 'fact',
  hypotheses: 'hypothesis',
  experiments: 'experiment',
  gaps: 'gap',
  residuals: 'residual',
  decisions: 'decision'
};

export type ProjectionTableName = typeof PROJECTION_TABLE_NAMES[number];

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
  stage: string;
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
    evidence_refs: new Map(),
    inquiries: new Map(),
    entities: new Map(),
    symptoms: new Map(),
    artifacts: new Map(),
    facts: new Map(),
    hypotheses: new Map(),
    experiments: new Map(),
    gaps: new Map(),
    residuals: new Map(),
    decisions: new Map()
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
    stage: record.stage,
    revision: record.revision,
    payload: structuredClone(asObject(record.payload))
  };
}

function toProjectedNodeRecord(tableName: CurrentStateTableName, record: CurrentStateNodeRecord): ProjectedNodeRecord {
  return {
    id: record.id,
    kind: NODE_KIND_BY_TABLE[tableName],
    caseId: record.caseId,
    revision: record.revision,
    status: record.status ?? null,
    payload: structuredClone(asObject(record.payload))
  };
}

function touchCaseRevision(state: ProjectedCaseState, revision: number): void {
  state.projectionRevision = revision;
  if (state.caseRecord) {
    state.caseRecord = {
      ...state.caseRecord,
      revision
    };
  }
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
      evidence_refs: [...state.tables.evidence_refs.values()].map((record) => structuredClone(record)),
      inquiries: [...state.tables.inquiries.values()].map((record) => structuredClone(record)),
      entities: [...state.tables.entities.values()].map((record) => structuredClone(record)),
      symptoms: [...state.tables.symptoms.values()].map((record) => structuredClone(record)),
      artifacts: [...state.tables.artifacts.values()].map((record) => structuredClone(record)),
      facts: [...state.tables.facts.values()].map((record) => structuredClone(record)),
      hypotheses: [...state.tables.hypotheses.values()].map((record) => structuredClone(record)),
      experiments: [...state.tables.experiments.values()].map((record) => structuredClone(record)),
      gaps: [...state.tables.gaps.values()].map((record) => structuredClone(record)),
      residuals: [...state.tables.residuals.values()].map((record) => structuredClone(record)),
      decisions: [...state.tables.decisions.values()].map((record) => structuredClone(record))
    }
  };
}

function restoreFromCheckpoint(
  caseId: string,
  headRevision: number,
  checkpoint: CheckpointRecord | undefined
): ProjectedCaseState | null {
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
    const stage = asString(record.stage);
    if (status && stage) {
      state.caseRecord = {
        id: asString(record.id) ?? caseId,
        title: asString(record.title) ?? null,
        severity: asString(record.severity) ?? null,
        status,
        stage,
        revision: typeof record.revision === 'number' ? record.revision : projectionRevision,
        payload: structuredClone(asObject(record.payload))
      };
    }
  }

  const tables = asObject(projectionState.tables);
  for (const tableName of PROJECTION_TABLE_NAMES) {
    const serializedRows = tables[tableName];
    if (!Array.isArray(serializedRows)) {
      continue;
    }

    for (const row of serializedRows) {
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

function applyStoredEvent(state: ProjectedCaseState, event: StoredEvent): void {
  const payload = asObject(event.payload);

  switch (event.eventType) {
    case 'case.opened': {
      const caseId = asString(payload.caseId) ?? state.caseId;
      const title = asString(payload.title) ?? null;
      const objective = asString(payload.objective) ?? null;
      const severity = asString(payload.severity) ?? null;
      const defaultInquiryId = asString(payload.defaultInquiryId);

      state.caseRecord = {
        id: caseId,
        title,
        severity,
        status: 'active',
        stage: 'intake',
        revision: event.caseRevision,
        payload: {
          id: caseId,
          title,
          objective,
          severity,
          defaultInquiryId: defaultInquiryId ?? null,
          status: 'active',
          stage: 'intake'
        }
      };

      if (defaultInquiryId) {
        upsertNode(state, 'inquiries', defaultInquiryId, event.caseRevision, {
          id: defaultInquiryId,
          caseId,
          title: 'Default inquiry',
          question: objective,
          priority: severity,
          status: 'open'
        }, 'open');
      }

      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'case.stage_advanced': {
      const stage = asString(payload.stage) ?? state.caseRecord?.stage ?? 'intake';
      const status = asString(payload.status) ?? state.caseRecord?.status ?? 'active';
      state.caseRecord = {
        id: state.caseRecord?.id ?? state.caseId,
        title: state.caseRecord?.title ?? null,
        severity: state.caseRecord?.severity ?? null,
        status,
        stage,
        revision: event.caseRevision,
        payload: {
          ...(state.caseRecord?.payload ?? { id: state.caseId }),
          stage,
          status,
          reason: payload.reason ?? null
        }
      };
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'inquiry.opened': {
      const inquiryId = asString(payload.inquiryId);
      if (inquiryId) {
        upsertNode(state, 'inquiries', inquiryId, event.caseRevision, {
          id: inquiryId,
          caseId: state.caseId,
          title: asString(payload.title) ?? null,
          question: asString(payload.question) ?? null,
          priority: asString(payload.priority) ?? null,
          scopeRefs: asStringArray(payload.scopeRefs),
          status: 'open'
        }, 'open');
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'inquiry.closed': {
      const inquiryId = asString(payload.inquiryId);
      if (inquiryId) {
        const resolutionKind = asString(payload.resolutionKind) ?? 'closed';
        const nextStatus = resolutionKind === 'merged' ? 'merged' : 'closed';
        patchNode(state, 'inquiries', inquiryId, event.caseRevision, {
          resolutionKind,
          reason: payload.reason ?? null,
          status: nextStatus
        }, nextStatus);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'entity.registered': {
      const entityId = asString(payload.entityId);
      if (entityId) {
        upsertNode(state, 'entities', entityId, event.caseRevision, {
          id: entityId,
          caseId: state.caseId,
          entityKind: asString(payload.entityKind) ?? null,
          name: asString(payload.name) ?? null,
          locator: structuredClone(asObject(payload.locator))
        });
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'symptom.reported': {
      const symptomId = asString(payload.symptomId);
      if (symptomId) {
        upsertNode(state, 'symptoms', symptomId, event.caseRevision, {
          id: symptomId,
          caseId: state.caseId,
          statement: asString(payload.statement) ?? null,
          severity: asString(payload.severity) ?? null,
          reproducibility: asString(payload.reproducibility) ?? null,
          affectedRefs: asStringArray(payload.affectedRefs)
        });
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'artifact.attached': {
      const artifactId = asString(payload.artifactId);
      if (artifactId) {
        upsertNode(state, 'artifacts', artifactId, event.caseRevision, {
          id: artifactId,
          caseId: state.caseId,
          artifactKind: asString(payload.artifactKind) ?? null,
          title: asString(payload.title) ?? null,
          source: structuredClone(asObject(payload.source)),
          contentRef: payload.contentRef ?? null,
          excerpt: payload.excerpt ?? null,
          aboutRefs: asStringArray(payload.aboutRefs)
        });
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'fact.asserted': {
      const factId = asString(payload.factId);
      if (factId) {
        upsertNode(state, 'facts', factId, event.caseRevision, {
          id: factId,
          caseId: state.caseId,
          inquiryId: asString(payload.inquiryId) ?? null,
          statement: asString(payload.statement) ?? null,
          factKind: asString(payload.factKind) ?? null,
          polarity: asString(payload.polarity) ?? null,
          sourceArtifactIds: asStringArray(payload.sourceArtifactIds),
          aboutRefs: asStringArray(payload.aboutRefs),
          observationScope: payload.observationScope ?? null,
          status: 'active'
        }, 'active');
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'hypothesis.proposed': {
      const hypothesisId = asString(payload.hypothesisId);
      if (hypothesisId) {
        upsertNode(state, 'hypotheses', hypothesisId, event.caseRevision, {
          id: hypothesisId,
          caseId: state.caseId,
          inquiryId: asString(payload.inquiryId) ?? null,
          title: asString(payload.title) ?? null,
          statement: asString(payload.statement) ?? null,
          level: asString(payload.level) ?? null,
          status: asString(payload.status) ?? 'proposed',
          explainsSymptomIds: asStringArray(payload.explainsSymptomIds),
          dependsOnFactIds: asStringArray(payload.dependsOnFactIds),
          falsificationCriteria: asStringArray(payload.falsificationCriteria)
        }, asString(payload.status) ?? 'proposed');
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'hypothesis.status_updated': {
      const hypothesisId = asString(payload.hypothesisId);
      const nextStatus = asString(payload.newStatus);
      if (hypothesisId && nextStatus) {
        patchNode(state, 'hypotheses', hypothesisId, event.caseRevision, {
          status: nextStatus,
          reason: payload.reason ?? null,
          reasonFactIds: asStringArray(payload.reasonFactIds),
          reasonExperimentIds: asStringArray(payload.reasonExperimentIds)
        }, nextStatus);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'experiment.planned': {
      const experimentId = asString(payload.experimentId);
      const status = asString(payload.status) ?? 'planned';
      if (experimentId) {
        upsertNode(state, 'experiments', experimentId, event.caseRevision, {
          id: experimentId,
          caseId: state.caseId,
          inquiryId: asString(payload.inquiryId) ?? null,
          title: asString(payload.title) ?? null,
          objective: asString(payload.objective) ?? null,
          method: asString(payload.method) ?? null,
          status,
          testsHypothesisIds: asStringArray(payload.testsHypothesisIds),
          expectedOutcomes: Array.isArray(payload.expectedOutcomes) ? structuredClone(payload.expectedOutcomes) : [],
          cost: asString(payload.cost) ?? null,
          risk: asString(payload.risk) ?? null
        }, status);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'experiment.result_recorded': {
      const experimentId = asString(payload.experimentId);
      const nextStatus = asString(payload.status);
      if (experimentId && nextStatus) {
        patchNode(state, 'experiments', experimentId, event.caseRevision, {
          status: nextStatus,
          summary: asString(payload.summary) ?? null,
          producedArtifactIds: asStringArray(payload.producedArtifactIds),
          producedFactIds: asStringArray(payload.producedFactIds)
        }, nextStatus);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'gap.opened': {
      const gapId = asString(payload.gapId);
      const status = asString(payload.status) ?? 'open';
      if (gapId) {
        upsertNode(state, 'gaps', gapId, event.caseRevision, {
          id: gapId,
          caseId: state.caseId,
          question: asString(payload.question) ?? null,
          priority: asString(payload.priority) ?? null,
          status,
          blockedRefs: asStringArray(payload.blockedRefs)
        }, status);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'gap.resolved': {
      const gapId = asString(payload.gapId);
      const nextStatus = asString(payload.status);
      if (gapId && nextStatus) {
        patchNode(state, 'gaps', gapId, event.caseRevision, {
          status: nextStatus,
          reason: payload.reason ?? null,
          resolutionFactIds: asStringArray(payload.resolutionFactIds),
          resolutionExperimentIds: asStringArray(payload.resolutionExperimentIds)
        }, nextStatus);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'residual.opened': {
      const residualId = asString(payload.residualId);
      const status = asString(payload.status) ?? 'open';
      if (residualId) {
        upsertNode(state, 'residuals', residualId, event.caseRevision, {
          id: residualId,
          caseId: state.caseId,
          statement: asString(payload.statement) ?? null,
          severity: asString(payload.severity) ?? null,
          status,
          relatedSymptomIds: asStringArray(payload.relatedSymptomIds)
        }, status);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'residual.updated': {
      const residualId = asString(payload.residualId);
      const nextStatus = asString(payload.newStatus);
      if (residualId && nextStatus) {
        patchNode(state, 'residuals', residualId, event.caseRevision, {
          status: nextStatus,
          rationale: payload.rationale ?? null,
          reasonFactIds: asStringArray(payload.reasonFactIds),
          reasonHypothesisIds: asStringArray(payload.reasonHypothesisIds)
        }, nextStatus);
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    case 'decision.recorded': {
      const decisionId = asString(payload.decisionId);
      if (decisionId) {
        upsertNode(state, 'decisions', decisionId, event.caseRevision, {
          id: decisionId,
          caseId: state.caseId,
          inquiryId: asString(payload.inquiryId) ?? null,
          title: asString(payload.title) ?? null,
          decisionKind: asString(payload.decisionKind) ?? null,
          statement: asString(payload.statement) ?? null,
          supportingFactIds: asStringArray(payload.supportingFactIds),
          supportingExperimentIds: asStringArray(payload.supportingExperimentIds),
          supportingHypothesisIds: asStringArray(payload.supportingHypothesisIds),
          rationale: payload.rationale ?? null
        });
      }
      touchCaseRevision(state, event.caseRevision);
      return;
    }
    default:
      touchCaseRevision(state, event.caseRevision);
  }
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
    const tables = await Promise.all(PROJECTION_TABLE_NAMES.map((tableName) => currentState.listRecordsByCase(tableName, caseId)));
    const state = createEmptyProjectedCaseState(caseId, headRevision);
    state.projectionRevision = headRevision;
    state.caseRecord = caseRecord ? toProjectedCaseRecord(caseRecord) : null;

    PROJECTION_TABLE_NAMES.forEach((tableName, index) => {
      for (const record of tables[index] ?? []) {
        const projected = toProjectedNodeRecord(tableName, record);
        state.tables[tableName].set(projected.id, projected);
      }
    });

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
