import type { GraphNodeRecord } from './useGraphLayout.js';

export function getDisplayKind(node: Pick<GraphNodeRecord, 'kind' | 'displayKind'>): string {
  return node.displayKind ?? normalizeLegacyKind(node.kind);
}

export function getIssueSubtypeLabel(node: Pick<GraphNodeRecord, 'kind' | 'displayKind' | 'issueKind'>): string | null {
  if (getDisplayKind(node) !== 'issue') {
    return null;
  }

  return node.issueKind ?? null;
}

export function summarizeGraphNodes(nodes: GraphNodeRecord[]): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const displayKind = getDisplayKind(node);
    counts.set(displayKind, (counts.get(displayKind) ?? 0) + 1);
  }

  return [
    { kind: 'issue', count: counts.get('issue') ?? 0 },
    { kind: 'artifact', count: counts.get('artifact') ?? 0 },
    { kind: 'fact', count: counts.get('fact') ?? 0 },
    { kind: 'hypothesis', count: counts.get('hypothesis') ?? 0 }
  ];
}

function normalizeLegacyKind(kind: string): string {
  switch (kind) {
    case 'inquiry':
    case 'symptom':
    case 'gap':
    case 'residual':
      return 'issue';
    case 'entity':
      return 'context';
    default:
      return kind;
  }
}
