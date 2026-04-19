import type { CaseGraphEnvelope } from '../../lib/api.js';

const LEGACY_GRAPH_KINDS = new Set([
  'case',
  'inquiry',
  'symptom',
  'artifact',
  'fact',
  'experiment',
  'decision',
  'gap',
  'residual'
]);

const CANONICAL_ONLY_KINDS = new Set([
  'blocker',
  'repair_attempt',
  'evidence_ref'
]);

export function isCanonicalGraphProjection(graph: Pick<CaseGraphEnvelope, 'data'>): boolean {
  const kinds = new Set(graph.data.nodes.map((node) => node.kind));

  if (!kinds.has('problem')) {
    return false;
  }

  for (const kind of kinds) {
    if (CANONICAL_ONLY_KINDS.has(kind)) {
      return true;
    }
  }

  for (const kind of kinds) {
    if (LEGACY_GRAPH_KINDS.has(kind)) {
      return false;
    }
  }

  return true;
}
