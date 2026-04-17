import type { GraphNodeRecord } from './useGraphLayout.js';

export function getDisplayKind(node: Pick<GraphNodeRecord, 'kind' | 'displayKind'>): string {
  return node.displayKind ?? normalizeLegacyKind(node.kind);
}

export function summarizeGraphNodes(nodes: GraphNodeRecord[]): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const presentationKind = getPresentationKind(node);
    counts.set(presentationKind, (counts.get(presentationKind) ?? 0) + 1);
  }

  return [
    { kind: 'problem', count: counts.get('problem') ?? 0 },
    { kind: 'symptom', count: counts.get('symptom') ?? 0 },
    { kind: 'blocking_issue', count: counts.get('blocking_issue') ?? 0 },
    { kind: 'residual_risk', count: counts.get('residual_risk') ?? 0 },
    { kind: 'blocker', count: counts.get('blocker') ?? 0 },
    { kind: 'repair_attempt', count: counts.get('repair_attempt') ?? 0 },
    { kind: 'evidence_ref', count: counts.get('evidence_ref') ?? 0 },
    { kind: 'artifact', count: counts.get('artifact') ?? 0 },
    { kind: 'fact', count: counts.get('fact') ?? 0 },
    { kind: 'hypothesis', count: counts.get('hypothesis') ?? 0 }
  ].filter((item) => item.count > 0);
}

export function getPresentationKind(node: Pick<GraphNodeRecord, 'kind' | 'displayKind' | 'issueKind'>): string {
  const displayKind = getDisplayKind(node);
  if (displayKind !== 'issue') {
    return displayKind;
  }

  switch (node.issueKind) {
    case 'question':
    case 'symptom':
      return 'symptom';
    case 'blocking_issue':
      return 'blocking_issue';
    case 'residual_risk':
      return 'residual_risk';
    default:
      return 'symptom';
  }
}

function normalizeLegacyKind(kind: string): string {
  switch (kind) {
    case 'problem':
    case 'blocker':
    case 'repair_attempt':
    case 'evidence_ref':
      return kind;
    case 'symptom':
    case 'inquiry':
      return 'symptom';
    case 'gap':
    case 'residual':
      return kind;
    case 'entity':
      return 'context';
    default:
      return kind;
  }
}
