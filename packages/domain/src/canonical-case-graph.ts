import type { CanonicalHypothesisStatus } from './state-machines/canonical-hypothesis.js';

export type CanonicalGraphNodeKind = 'problem' | 'hypothesis' | 'evidence_ref' | 'blocker' | 'repair_attempt';

export type CanonicalProblemStatus = 'open' | 'resolved' | 'abandoned';
export type CanonicalBlockerStatus = 'active' | 'closed';
export type CanonicalRepairAttemptStatus = 'proposed' | 'running' | 'effective' | 'ineffective';

export type CanonicalNodeStatus =
  | CanonicalProblemStatus
  | CanonicalHypothesisStatus
  | CanonicalBlockerStatus
  | CanonicalRepairAttemptStatus
  | null;

export type CanonicalEvidenceKind =
  | 'log'
  | 'code'
  | 'trace'
  | 'reasoning'
  | 'experiment_result'
  | 'document'
  | 'other';

export type CanonicalReferenceMaterialKind =
  | 'log'
  | 'code'
  | 'trace'
  | 'screenshot'
  | 'conversation'
  | 'ticket'
  | 'document'
  | 'other';

export type CanonicalHypothesisEvidenceEffect = 'supports' | 'refutes' | 'neutral';
export type CanonicalRepairAttemptEvidenceEffect = 'validates' | 'invalidates' | 'neutral';
export type CanonicalEvidenceEffect = CanonicalHypothesisEvidenceEffect | CanonicalRepairAttemptEvidenceEffect;

export interface CanonicalGraphNodeRuleContext {
  parentKind: CanonicalGraphNodeKind;
  parentStatus: CanonicalNodeStatus;
}

export interface CanonicalGraphLinkLike {
  id: string;
  kind: CanonicalGraphNodeKind;
  parentId: null | string;
  parentKind: null | CanonicalGraphNodeKind;
  status: CanonicalNodeStatus;
}

const ALWAYS_ALLOWED_CHILDREN: Record<CanonicalGraphNodeKind, CanonicalGraphNodeKind[]> = {
  problem: ['hypothesis'],
  hypothesis: ['hypothesis', 'evidence_ref', 'blocker'],
  evidence_ref: [],
  blocker: [],
  repair_attempt: ['evidence_ref']
};

export function allowedCanonicalChildKinds(context: CanonicalGraphNodeRuleContext): CanonicalGraphNodeKind[] {
  const allowedKinds = [...ALWAYS_ALLOWED_CHILDREN[context.parentKind]];

  if (context.parentKind === 'hypothesis' && context.parentStatus === 'confirmed') {
    allowedKinds.push('repair_attempt');
  }

  if (context.parentKind === 'repair_attempt' && context.parentStatus === 'ineffective') {
    allowedKinds.push('repair_attempt');
  }

  return allowedKinds;
}

export function canCreateCanonicalChild(
  context: CanonicalGraphNodeRuleContext,
  childKind: CanonicalGraphNodeKind
): boolean {
  return allowedCanonicalChildKinds(context).includes(childKind);
}

export function assertCanonicalChildCreation(
  context: CanonicalGraphNodeRuleContext,
  childKind: CanonicalGraphNodeKind
) {
  if (!canCreateCanonicalChild(context, childKind)) {
    throw new Error(`Invalid canonical child creation: ${context.parentKind}(${String(context.parentStatus)}) -> ${childKind}`);
  }
}

export function isCanonicalLeafKind(kind: CanonicalGraphNodeKind): boolean {
  return kind === 'evidence_ref' || kind === 'blocker';
}

export function wouldIntroduceCanonicalCycle(
  nodes: Iterable<Pick<CanonicalGraphLinkLike, 'id' | 'parentId'>>,
  nextParentId: string,
  nodeId: string
): boolean {
  if (nextParentId === nodeId) {
    return true;
  }

  const parentLookup = new Map<string, null | string>();
  for (const node of nodes) {
    parentLookup.set(node.id, node.parentId);
  }

  let cursor: null | string = nextParentId;
  while (cursor) {
    if (cursor === nodeId) {
      return true;
    }

    cursor = parentLookup.get(cursor) ?? null;
  }

  return false;
}

export function validateCanonicalGraphStructure(nodes: CanonicalGraphLinkLike[]) {
  const problems = nodes.filter((node) => node.kind === 'problem');
  if (problems.length !== 1) {
    throw new Error(`Canonical case graph must contain exactly one problem root. Received ${problems.length}.`);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenIds = new Set<string>();

  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      throw new Error(`Duplicate canonical graph node id: ${node.id}`);
    }
    seenIds.add(node.id);

    if (node.kind === 'problem') {
      if (node.parentId || node.parentKind) {
        throw new Error('Problem root cannot have a parent.');
      }
      continue;
    }

    if (!node.parentId || !node.parentKind) {
      throw new Error(`Canonical node ${node.id} (${node.kind}) must have a parent.`);
    }

    if (!nodeIds.has(node.parentId)) {
      throw new Error(`Canonical node ${node.id} references missing parent ${node.parentId}.`);
    }

    assertCanonicalChildCreation(
      {
        parentKind: node.parentKind,
        parentStatus: findCanonicalNodeStatus(nodes, node.parentId)
      },
      node.kind
    );

    if (wouldIntroduceCanonicalCycle(nodes, node.parentId, node.id)) {
      throw new Error(`Canonical edge would introduce a cycle: ${node.parentId} -> ${node.id}`);
    }
  }
}

function findCanonicalNodeStatus(nodes: CanonicalGraphLinkLike[], nodeId: string): CanonicalNodeStatus {
  const node = nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Canonical graph references unknown node ${nodeId}.`);
  }

  return node.status;
}
