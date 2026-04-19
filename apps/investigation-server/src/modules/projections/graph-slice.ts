import { deriveProjectionEdges, type ProjectionEdge } from './edges.js';
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
  projectionModel: 'legacy' | 'canonical';
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
    ?? asString(payload.description)
    ?? asString(payload.changeSummary)
    ?? fallback;
}

function graphNodeSummary(kind: string, payload: Record<string, unknown>): string | null {
  return asString(payload.description)
    ?? asString(payload.statement)
    ?? asString(payload.interpretation)
    ?? asString(payload.changeSummary)
    ?? (kind === 'problem' ? asString(payload.environment) ?? null : null);
}

function canonicalEvidencePayload(payload: Record<string, unknown>, state: ProjectedCaseState) {
  const evidenceId = asString(payload.evidenceId);
  const evidenceRecord = evidenceId ? state.tables.evidence_pool.get(evidenceId) : null;
  return asObject(evidenceRecord?.payload);
}

export function buildGraphSlice(
  state: ProjectedCaseState,
  options: { focusId?: string | null; depth?: number } = {}
): GraphSlice {
  const nodes = new Map<string, GraphNode>();

  for (const record of listProjectedNodes(state)) {
    const payload = asObject(record.payload);
    nodes.set(record.id, {
      id: record.id,
      kind: record.kind,
      displayKind: record.kind,
      issueKind: null,
      label: record.kind === 'evidence_ref'
        ? asString(canonicalEvidencePayload(payload, state).title) ?? graphNodeLabel(payload, record.id)
        : graphNodeLabel(payload, record.id),
      payload: record.kind === 'evidence_ref'
        ? { ...payload, evidence: canonicalEvidencePayload(payload, state) }
        : payload,
      summary: graphNodeSummary(record.kind, payload),
      status: record.status,
      revision: record.revision
    });
  }

  const isCanonical = state.tables.problems.size > 0;

  return focusGraphSlice(nodes, deriveProjectionEdges(state), isCanonical, options);
}

function focusGraphSlice(
  nodes: Map<string, GraphNode>,
  edges: ProjectionEdge[],
  isCanonical: boolean,
  options: { focusId?: string | null; depth?: number } = {}
): GraphSlice {
  const focusId = options.focusId ?? null;
  const depth = Math.max(options.depth ?? 1, 1);
  const projectionModel = isCanonical ? 'canonical' as const : 'legacy' as const;

  if (!focusId || !nodes.has(focusId)) {
    return {
      focusId,
      projectionModel,
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
    projectionModel,
    nodes: [...nodes.values()]
      .filter((node) => selectedNodeIds.has(node.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.filter((edge) => selectedEdgeKeys.has(edge.key))
  };
}
