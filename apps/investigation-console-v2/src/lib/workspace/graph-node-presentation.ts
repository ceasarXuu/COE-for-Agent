import type { GraphNodeRecord } from './use-graph-layout.js';

export function getDisplayKind(node: Pick<GraphNodeRecord, 'kind' | 'displayKind'>): string {
  return node.displayKind ?? node.kind;
}

export function summarizeGraphNodes(nodes: GraphNodeRecord[]): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const presentationKind = getPresentationKind(node);
    counts.set(presentationKind, (counts.get(presentationKind) ?? 0) + 1);
  }

  return [
    { kind: 'problem', count: counts.get('problem') ?? 0 },
    { kind: 'blocker', count: counts.get('blocker') ?? 0 },
    { kind: 'repair_attempt', count: counts.get('repair_attempt') ?? 0 },
    { kind: 'evidence_ref', count: counts.get('evidence_ref') ?? 0 },
    { kind: 'hypothesis', count: counts.get('hypothesis') ?? 0 }
  ].filter((item) => item.count > 0);
}

export function getPresentationKind(node: Pick<GraphNodeRecord, 'kind' | 'displayKind' | 'issueKind'>): string {
  return getDisplayKind(node);
}
