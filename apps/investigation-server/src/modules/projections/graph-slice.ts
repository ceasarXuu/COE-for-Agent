import { deriveProjectionEdges, type ProjectionEdge } from './edges.js';
import { listProjectedNodes, type ProjectedCaseState } from './replay.js';

export interface GraphNode {
  id: string;
  kind: string;
  displayKind?: string;
  issueKind?: string | null;
  label: string;
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

export function buildGraphSlice(
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
    const display = classifyGraphNode(record.kind);
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
      status: record.status,
      revision: record.revision
    });
  }

  const edges = deriveProjectionEdges(state).filter((edge) => nodes.has(edge.fromId) && nodes.has(edge.toId));
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

function classifyGraphNode(kind: string): {
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
        include: true,
        displayKind: 'issue',
        issueKind: 'question'
      };
    case 'symptom':
      return {
        include: true,
        displayKind: 'issue',
        issueKind: 'symptom'
      };
    case 'gap':
      return {
        include: true,
        displayKind: 'issue',
        issueKind: 'blocking_issue'
      };
    case 'residual':
      return {
        include: true,
        displayKind: 'issue',
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
