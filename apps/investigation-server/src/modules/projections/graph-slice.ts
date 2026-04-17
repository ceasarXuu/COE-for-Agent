import { deriveProjectionEdges, isCanonicalGraphState, type ProjectionEdge } from './edges.js';
import { listProjectedNodes, type ProjectedCaseState } from './replay.js';

export interface GraphNode {
  id: string;
  kind: string;
  displayKind?: string;
  issueKind?: string | null;
  label: string;
  payload?: Record<string, unknown>;
  summary?: null | string;
  status: string | null;
  revision: number;
}

export interface GraphSlice {
  focusId: string | null;
  nodes: GraphNode[];
  edges: ProjectionEdge[];
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function graphNodeLabel(payload: Record<string, unknown>, fallback: string): string {
  return asString(payload.title)
    ?? asString(payload.name)
    ?? asString(payload.statement)
    ?? asString(payload.question)
    ?? asString(payload.objective)
    ?? fallback;
}

function graphNodeSummary(kind: string, payload: Record<string, unknown>): string | null {
  return asString(payload.description)
    ?? asString(payload.statement)
    ?? asString(payload.interpretation)
    ?? asString(payload.changeSummary)
    ?? (kind === 'problem' ? asString(payload.environment) ?? null : null);
}

function canonicalGraphNodeLabel(kind: string, payload: Record<string, unknown>, state: ProjectedCaseState): string {
  if (kind === 'evidence_ref') {
    const evidenceId = asString(payload.evidenceId);
    const evidenceRecord = evidenceId ? state.tables.evidence_pool.get(evidenceId) : null;
    const evidencePayload = asObject(evidenceRecord?.payload);

    return asString(evidencePayload.title)
      ?? asString(payload.interpretation)
      ?? evidenceId
      ?? kind;
  }

  return graphNodeLabel(payload, kind);
}

export function buildGraphSlice(
  state: ProjectedCaseState,
  options: { focusId?: string | null; depth?: number } = {}
): GraphSlice {
  return isCanonicalGraphState(state)
    ? buildCanonicalGraphSlice(state, options)
    : buildLegacyGraphSlice(state, options);
}

function buildLegacyGraphSlice(
  state: ProjectedCaseState,
  options: { focusId?: string | null; depth?: number } = {}
): GraphSlice {
  const nodes = new Map<string, GraphNode>();

  if (state.caseRecord) {
    nodes.set(state.caseRecord.id, {
      id: state.caseRecord.id,
      kind: 'case',
      displayKind: 'case',
      issueKind: null,
      label: state.caseRecord.title ?? state.caseRecord.id,
      status: state.caseRecord.status,
      revision: state.caseRecord.revision
    });
  }

  for (const record of listProjectedNodes(state)) {
    const display = classifyLegacyGraphNode(record.kind);
    if (!display.include) {
      continue;
    }

    const payload = asObject(record.payload);
    nodes.set(record.id, {
      id: record.id,
      kind: record.kind,
      displayKind: display.displayKind,
      issueKind: display.issueKind,
      label: graphNodeLabel(payload, record.id),
      payload,
      summary: graphNodeSummary(record.kind, payload),
      status: record.status,
      revision: record.revision
    });
  }

  return focusGraphSlice(nodes, deriveProjectionEdges(state), options);
}

function buildCanonicalGraphSlice(
  state: ProjectedCaseState,
  options: { focusId?: string | null; depth?: number } = {}
): GraphSlice {
  const nodes = new Map<string, GraphNode>();

  for (const record of [
    ...state.tables.problems.values(),
    ...state.tables.hypotheses.values(),
    ...state.tables.blockers.values(),
    ...state.tables.repair_attempts.values(),
    ...state.tables.evidence_refs.values()
  ]) {
    if (record.kind === 'hypothesis' && asString(asObject(record.payload).canonicalKind) !== 'hypothesis') {
      continue;
    }

    const payload = asObject(record.payload);
    nodes.set(record.id, {
      id: record.id,
      kind: record.kind,
      displayKind: record.kind,
      issueKind: null,
      label: canonicalGraphNodeLabel(record.kind, payload, state),
      payload,
      summary: graphNodeSummary(record.kind, payload),
      status: record.status,
      revision: record.revision
    });
  }

  return focusGraphSlice(nodes, deriveProjectionEdges(state), options);
}

function focusGraphSlice(
  nodes: Map<string, GraphNode>,
  derivedEdges: ProjectionEdge[],
  options: { focusId?: string | null; depth?: number } = {}
): GraphSlice {
  const edges = derivedEdges.filter((edge) => nodes.has(edge.fromId) && nodes.has(edge.toId));
  const focusId = options.focusId ?? null;
  const depth = Math.max(options.depth ?? 1, 1);

  if (!focusId || !nodes.has(focusId)) {
    return {
      focusId,
      nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
      edges
    };
  }

  const selectedNodeIds = new Set<string>([focusId]);
  const selectedEdgeKeys = new Set<string>();
  let frontier = new Set<string>([focusId]);

  for (let level = 0; level < depth; level += 1) {
    const nextFrontier = new Set<string>();
    for (const edge of edges) {
      if (!frontier.has(edge.fromId) && !frontier.has(edge.toId)) {
        continue;
      }

      selectedEdgeKeys.add(edge.key);
      if (!selectedNodeIds.has(edge.fromId)) {
        selectedNodeIds.add(edge.fromId);
        nextFrontier.add(edge.fromId);
      }
      if (!selectedNodeIds.has(edge.toId)) {
        selectedNodeIds.add(edge.toId);
        nextFrontier.add(edge.toId);
      }
    }
    frontier = nextFrontier;
  }

  return {
    focusId,
    nodes: [...nodes.values()]
      .filter((node) => selectedNodeIds.has(node.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.filter((edge) => selectedEdgeKeys.has(edge.key))
  };
}

function classifyLegacyGraphNode(kind: string): {
  include: boolean;
  displayKind: string;
  issueKind: string | null;
} {
  switch (kind) {
    case 'entity':
      return {
        include: false,
        displayKind: 'context',
        issueKind: null
      };
    case 'inquiry':
      return {
        include: false,
        displayKind: 'symptom',
        issueKind: 'symptom'
      };
    case 'symptom':
      return {
        include: true,
        displayKind: 'symptom',
        issueKind: 'symptom'
      };
    case 'gap':
      return {
        include: true,
        displayKind: 'blocking_issue',
        issueKind: 'blocking_issue'
      };
    case 'residual':
      return {
        include: true,
        displayKind: 'residual_risk',
        issueKind: 'residual_risk'
      };
    default:
      return {
        include: true,
        displayKind: kind,
        issueKind: null
      };
  }
}
