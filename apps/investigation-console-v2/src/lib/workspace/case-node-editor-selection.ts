import type { GraphNodeRecord } from '../api.js';
import type { DraftNodeRecord } from './case-node-drafts.js';

export function buildNodeEditorSyncKey(
  selectedDraftNode: DraftNodeRecord | null,
  selectedNode: GraphNodeRecord | null
) {
  if (selectedDraftNode) {
    return `draft:${selectedDraftNode.id}:${selectedDraftNode.status}`;
  }

  if (selectedNode) {
    return `saved:${selectedNode.id}:${selectedNode.revision}`;
  }

  return 'empty';
}
