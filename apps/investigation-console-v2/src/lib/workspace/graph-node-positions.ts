export interface GraphNodePosition {
  x: number;
  y: number;
}

export type GraphNodePositionMap = Record<string, GraphNodePosition>;

export function buildGraphNodePositionStorageKey(input: {
  caseId: string;
  requestedRevision: number | null;
}) {
  return `investigation-console-v2.graph-node-positions:${input.caseId}:${input.requestedRevision ?? 'head'}`;
}

export function mergeGraphNodePositions<T extends { id: string; position: GraphNodePosition }>(
  nodes: T[],
  overrides: GraphNodePositionMap
) {
  return nodes.map((node) => {
    const override = overrides[node.id];
    if (!override) {
      return node;
    }

    return {
      ...node,
      position: override
    };
  });
}

export function readGraphNodePositions(
  storage: Pick<Storage, 'getItem'> | undefined,
  storageKey: string | null
): GraphNodePositionMap {
  if (!storage || !storageKey) {
    return {};
  }

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const result: GraphNodePositionMap = {};

    for (const [nodeId, position] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof position === 'object' &&
        position !== null &&
        !Array.isArray(position) &&
        typeof (position as { x?: unknown }).x === 'number' &&
        typeof (position as { y?: unknown }).y === 'number'
      ) {
        result[nodeId] = {
          x: (position as { x: number }).x,
          y: (position as { y: number }).y
        };
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function writeGraphNodePositions(
  storage: Pick<Storage, 'setItem'> | undefined,
  storageKey: string | null,
  positions: GraphNodePositionMap
) {
  if (!storage || !storageKey) {
    return;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(positions));
  } catch {
    return;
  }
}

export function upsertGraphNodePosition(
  positions: GraphNodePositionMap,
  nodeId: string,
  position: GraphNodePosition
) {
  return {
    ...positions,
    [nodeId]: position
  };
}

export function getGraphNodePositionStorage() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
