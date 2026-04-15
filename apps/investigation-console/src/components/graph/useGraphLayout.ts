import type { CaseGraphEnvelope } from '../../lib/api.js';

export interface GraphNodeRecord {
  id: string;
  kind: string;
  displayKind?: string;
  issueKind?: string | null;
  label: string;
  status: string | null;
  revision: number;
}

function getDisplayKind(node: Pick<GraphNodeRecord, 'kind' | 'displayKind'>): string {
  return node.displayKind ?? node.kind;
}

export function useGraphLayout(
  graph: CaseGraphEnvelope,
  compareText: (left: string, right: string) => number = (left, right) => left.localeCompare(right)
) {
  const focusId = graph.data.focusId;
  const distances = computeFocusDistances(graph, focusId);
  const laneLookup = new Map<string, number>();

  const LANE_ORDER = [
    ['case'],
    ['issue', 'artifact'],
    ['fact'],
    ['hypothesis'],
    ['experiment'],
    ['decision']
  ] as const;

  LANE_ORDER.forEach((kinds, laneIndex) => {
    kinds.forEach((kind) => {
      laneLookup.set(kind, laneIndex);
    });
  });

  const laneCount = LANE_ORDER.length + 1;
  const lanes = Array.from({ length: laneCount }, () => [] as GraphNodeRecord[]);

  for (const node of graph.data.nodes) {
    const lane = laneLookup.get(getDisplayKind(node)) ?? laneCount - 1;
    const laneNodes = lanes[lane];

    if (!laneNodes) {
      continue;
    }

    laneNodes.push({
      id: node.id,
      kind: node.kind,
      displayKind: node.displayKind,
      issueKind: node.issueKind,
      label: node.label,
      status: node.status ?? null,
      revision: node.revision
    });
  }

  for (const lane of lanes) {
    lane.sort((left, right) => {
      const distanceDelta = getDistance(distances, left.id) - getDistance(distances, right.id);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }

      return compareText(left.label, right.label);
    });
  }

  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 120;
  const COLUMN_GAP = 72;
  const ROW_GAP = 32;
  const PAD_X = 40;
  const PAD_Y = 40;

  const maxRows = Math.max(...lanes.map((lane) => lane.length), 1);
  const activeLaneCount = Math.max(
    lanes.reduce((max, lane, laneIndex) => (lane.length > 0 ? laneIndex + 1 : max), 0),
    1
  );
  const width = PAD_X * 2 + activeLaneCount * NODE_WIDTH + (activeLaneCount - 1) * COLUMN_GAP;
  const height = PAD_Y * 2 + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP;

  const nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: GraphNodeRecord;
  }> = [];
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    data?: { type: string };
  }> = [];

  lanes.forEach((lane, laneIndex) => {
    if (lane.length === 0) {
      return;
    }

    const laneHeight = lane.length * NODE_HEIGHT + Math.max(lane.length - 1, 0) * ROW_GAP;
    const laneOffset = PAD_Y + (height - PAD_Y * 2 - laneHeight) / 2;
    const x = PAD_X + laneIndex * (NODE_WIDTH + COLUMN_GAP);

    lane.forEach((node, index) => {
      nodes.push({
        id: node.id,
        type: getDisplayKind(node),
        position: {
          x,
          y: laneOffset + index * (NODE_HEIGHT + ROW_GAP)
        },
        data: node
      });
    });
  });

  for (const edge of graph.data.edges) {
    edges.push({
      id: edge.key,
      source: edge.fromId,
      target: edge.toId,
      type: 'glowing',
      data: { type: edge.type }
    });
  }

  return { nodes, edges };
}

function computeFocusDistances(graph: CaseGraphEnvelope, focusId: string | null): Map<string, number> {
  if (!focusId) {
    return new Map();
  }

  const adjacency = new Map<string, Set<string>>();

  for (const node of graph.data.nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of graph.data.edges) {
    adjacency.get(edge.fromId)?.add(edge.toId);
    adjacency.get(edge.toId)?.add(edge.fromId);
  }

  const distances = new Map<string, number>([[focusId, 0]]);
  const queue = [focusId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentDistance = distances.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (!distances.has(next)) {
        distances.set(next, currentDistance + 1);
        queue.push(next);
      }
    }
  }

  return distances;
}

function getDistance(distances: Map<string, number>, nodeId: string): number {
  return distances.get(nodeId) ?? Number.MAX_SAFE_INTEGER;
}
