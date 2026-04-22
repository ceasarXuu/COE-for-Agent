import type { DraftNodeRecord } from './case-node-drafts.js';

export function reconcilePersistedDraftSelection(input: {
  draftNodes: DraftNodeRecord[];
  persistedNodeIds: Set<string>;
  selectedNodeId: string | null;
}) {
  let nextSelectedNodeId: string | null = null;

  const draftNodes = input.draftNodes.filter((draftNode) => {
    if (!draftNode.persistedNodeId || !input.persistedNodeIds.has(draftNode.persistedNodeId)) {
      return true;
    }

    if (input.selectedNodeId === draftNode.id) {
      nextSelectedNodeId = draftNode.persistedNodeId;
    }

    return false;
  });

  return {
    draftNodes,
    nextSelectedNodeId
  };
}
