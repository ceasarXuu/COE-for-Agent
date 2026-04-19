import { describe, expect, test } from 'vitest';

import { reconcilePersistedDraftSelection } from '../src/routes/case-workspace-draft-reconciliation.js';

describe('case workspace draft reconciliation', () => {
  test('switches selection to the persisted node when the selected draft is now present in the graph', () => {
    const result = reconcilePersistedDraftSelection({
      draftNodes: [
        {
          id: 'draft_hypothesis_01',
          kind: 'hypothesis',
          parentNodeId: 'problem_01',
          parentKind: 'problem',
          persistedNodeId: 'hypothesis_01',
          position: { x: 320, y: 220 },
          revision: 0,
          status: 'saving',
          label: 'Unsaved hypothesis',
          summary: null,
          payload: {
            statement: 'Unsaved hypothesis'
          }
        }
      ],
      persistedNodeIds: new Set(['problem_01', 'hypothesis_01']),
      selectedNodeId: 'draft_hypothesis_01'
    });

    expect(result.draftNodes).toEqual([]);
    expect(result.nextSelectedNodeId).toBe('hypothesis_01');
  });

  test('keeps unrelated drafts and leaves selection untouched when nothing has persisted yet', () => {
    const result = reconcilePersistedDraftSelection({
      draftNodes: [
        {
          id: 'draft_hypothesis_01',
          kind: 'hypothesis',
          parentNodeId: 'problem_01',
          parentKind: 'problem',
          persistedNodeId: null,
          position: { x: 320, y: 220 },
          revision: 0,
          status: 'draft',
          label: 'Unsaved hypothesis',
          summary: null,
          payload: {
            statement: 'Unsaved hypothesis'
          }
        }
      ],
      persistedNodeIds: new Set(['problem_01']),
      selectedNodeId: 'draft_hypothesis_01'
    });

    expect(result.draftNodes).toHaveLength(1);
    expect(result.nextSelectedNodeId).toBeNull();
  });
});
