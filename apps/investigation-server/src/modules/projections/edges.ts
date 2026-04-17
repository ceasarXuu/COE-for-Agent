import type { ProjectedCaseState } from './replay.js';

export interface ProjectionEdge {
  key: string;
  type: 'evidences' | 'supports' | 'contradicts' | 'explains' | 'tests' | 'blocks' | 'unresolved_by' | 'structural';
  fromId: string;
  toId: string;
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

function edgeKey(type: ProjectionEdge['type'], fromId: string, toId: string): string {
  return `${type}:${fromId}:${toId}`;
}

function addEdge(edges: Map<string, ProjectionEdge>, type: ProjectionEdge['type'], fromId: string, toId: string): void {
  if (!fromId || !toId) {
    return;
  }

  const key = edgeKey(type, fromId, toId);
  edges.set(key, {
    key,
    type,
    fromId,
    toId
  });
}

export function deriveProjectionEdges(state: ProjectedCaseState): ProjectionEdge[] {
  if (isCanonicalGraphState(state)) {
    return deriveCanonicalEdges(state);
  }

  return deriveLegacyEdges(state);
}

function deriveLegacyEdges(state: ProjectedCaseState): ProjectionEdge[] {
  const edges = new Map<string, ProjectionEdge>();

  for (const artifact of state.tables.artifacts.values()) {
    const payload = asObject(artifact.payload);
    for (const ref of asStringArray(payload.aboutRefs)) {
      addEdge(edges, 'evidences', artifact.id, ref);
    }
  }

  for (const fact of state.tables.facts.values()) {
    const payload = asObject(fact.payload);
    for (const artifactId of asStringArray(payload.sourceArtifactIds)) {
      addEdge(edges, 'evidences', artifactId, fact.id);
    }

    const relation = asString(payload.polarity) === 'negative' ? 'contradicts' : 'supports';
    for (const ref of asStringArray(payload.aboutRefs)) {
      addEdge(edges, relation, fact.id, ref);
    }
  }

  for (const hypothesis of state.tables.hypotheses.values()) {
    const payload = asObject(hypothesis.payload);
    for (const symptomId of asStringArray(payload.explainsSymptomIds)) {
      addEdge(edges, 'explains', hypothesis.id, symptomId);
    }

    for (const factId of asStringArray(payload.dependsOnFactIds)) {
      addEdge(edges, 'supports', factId, hypothesis.id);
    }
  }

  for (const experiment of state.tables.experiments.values()) {
    const payload = asObject(experiment.payload);
    for (const hypothesisId of asStringArray(payload.testsHypothesisIds)) {
      addEdge(edges, 'tests', experiment.id, hypothesisId);
    }
  }

  for (const gap of state.tables.gaps.values()) {
    const payload = asObject(gap.payload);
    for (const blockedRef of asStringArray(payload.blockedRefs)) {
      addEdge(edges, 'blocks', gap.id, blockedRef);
    }
  }

  for (const residual of state.tables.residuals.values()) {
    const payload = asObject(residual.payload);
    for (const symptomId of asStringArray(payload.relatedSymptomIds)) {
      addEdge(edges, 'unresolved_by', symptomId, residual.id);
    }
  }

  return [...edges.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function deriveCanonicalEdges(state: ProjectedCaseState): ProjectionEdge[] {
  const edges = new Map<string, ProjectionEdge>();

  for (const table of [state.tables.hypotheses, state.tables.blockers, state.tables.repair_attempts, state.tables.evidence_refs]) {
    for (const record of table.values()) {
      const payload = asObject(record.payload);
      const parentNodeId = asString(payload.parentNodeId);
      if (!parentNodeId) {
        continue;
      }

      addEdge(edges, 'structural', parentNodeId, record.id);
    }
  }

  return [...edges.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function isCanonicalGraphState(state: ProjectedCaseState): boolean {
  if (state.tables.problems.size === 0) {
    return false;
  }

  const hasCanonicalChildren = [...state.tables.hypotheses.values()].some((record) => asString(asObject(record.payload).canonicalKind) === 'hypothesis')
    || state.tables.blockers.size > 0
    || state.tables.repair_attempts.size > 0
    || state.tables.evidence_refs.size > 0;

  if (hasCanonicalChildren) {
    return true;
  }

  const hasLegacyGraphNodes = state.tables.symptoms.size > 0
    || state.tables.artifacts.size > 0
    || state.tables.facts.size > 0
    || [...state.tables.hypotheses.values()].some((record) => asString(asObject(record.payload).canonicalKind) !== 'hypothesis')
    || state.tables.experiments.size > 0
    || state.tables.gaps.size > 0
    || state.tables.residuals.size > 0
    || state.tables.decisions.size > 0;

  return !hasLegacyGraphNodes;
}
