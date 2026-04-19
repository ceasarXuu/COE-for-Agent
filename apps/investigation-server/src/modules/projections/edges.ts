import type { ProjectedCaseState } from './replay.js';

export interface ProjectionEdge {
  key: string;
  type: 'structural';
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

function edgeKey(fromId: string, toId: string): string {
  return `structural:${fromId}:${toId}`;
}

export function deriveProjectionEdges(state: ProjectedCaseState): ProjectionEdge[] {
  const edges = new Map<string, ProjectionEdge>();

  for (const table of [state.tables.hypotheses, state.tables.blockers, state.tables.repair_attempts, state.tables.evidence_refs]) {
    for (const record of table.values()) {
      const payload = asObject(record.payload);
      const parentNodeId = asString(payload.parentNodeId);
      if (!parentNodeId) {
        continue;
      }

      const key = edgeKey(parentNodeId, record.id);
      edges.set(key, {
        key,
        type: 'structural',
        fromId: parentNodeId,
        toId: record.id
      });
    }
  }

  return [...edges.values()].sort((left, right) => left.key.localeCompare(right.key));
}
