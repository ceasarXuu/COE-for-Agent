import { deriveProjectionEdges } from './edges.js';
import { listProjectedNodes, type ProjectedCaseState } from './replay.js';

export interface StateTransition {
  nodeId: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
}

export interface DiffProjection {
  fromRevision: number;
  toRevision: number;
  changedNodeIds: string[];
  changedEdgeKeys: string[];
  stateTransitions: StateTransition[];
  summary: string[];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${key}:${stableStringify(entry)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

export function buildDiffProjection(fromState: ProjectedCaseState, toState: ProjectedCaseState): DiffProjection {
  const fromNodes = new Map(listProjectedNodes(fromState).map((record) => [record.id, record]));
  const toNodes = new Map(listProjectedNodes(toState).map((record) => [record.id, record]));
  const changedNodeIds = new Set<string>();
  const stateTransitions: StateTransition[] = [];
  const nodeIds = new Set<string>([...fromNodes.keys(), ...toNodes.keys()]);

  for (const nodeId of nodeIds) {
    const before = fromNodes.get(nodeId);
    const after = toNodes.get(nodeId);

    if (!before || !after) {
      changedNodeIds.add(nodeId);
      continue;
    }

    const beforePayload = stableStringify(before.payload);
    const afterPayload = stableStringify(after.payload);
    if (before.status !== after.status || beforePayload !== afterPayload) {
      changedNodeIds.add(nodeId);
    }

    if (before.status !== after.status) {
      stateTransitions.push({
        nodeId,
        kind: after.kind,
        fromStatus: before.status,
        toStatus: after.status
      });
    }
  }

  const fromEdges = new Set(deriveProjectionEdges(fromState).map((edge) => edge.key));
  const toEdges = new Set(deriveProjectionEdges(toState).map((edge) => edge.key));
  const changedEdgeKeys = [...new Set([
    ...[...fromEdges].filter((key) => !toEdges.has(key)),
    ...[...toEdges].filter((key) => !fromEdges.has(key))
  ])].sort();

  return {
    fromRevision: fromState.projectionRevision,
    toRevision: toState.projectionRevision,
    changedNodeIds: [...changedNodeIds].sort(),
    changedEdgeKeys,
    stateTransitions: stateTransitions.sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    summary: [
      `${changedNodeIds.size} nodes changed`,
      `${stateTransitions.length} state transitions`,
      `${changedEdgeKeys.length} edges changed`
    ]
  };
}