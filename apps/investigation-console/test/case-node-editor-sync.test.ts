import { describe, expect, test } from 'vitest';

import { buildNodeEditorSyncKey } from '../src/components/node-editor/case-node-editor-selection.js';

describe('case node editor sync key', () => {
  test('keeps the same sync key when the selected saved node refreshes with the same revision', () => {
    const firstKey = buildNodeEditorSyncKey(null, {
      id: 'hypothesis_01',
      kind: 'hypothesis',
      label: 'Worker pool starvation',
      status: 'unverified',
      revision: 5,
      payload: {
        title: 'Worker pool starvation',
        statement: 'Worker pool starvation'
      }
    });

    const refreshedKey = buildNodeEditorSyncKey(null, {
      id: 'hypothesis_01',
      kind: 'hypothesis',
      label: 'Worker pool starvation',
      status: 'unverified',
      revision: 5,
      payload: {
        title: 'Worker pool starvation',
        statement: 'Worker pool starvation (refreshed object)'
      }
    });

    expect(refreshedKey).toBe(firstKey);
  });

  test('changes the sync key when the saved node revision changes', () => {
    const beforeSave = buildNodeEditorSyncKey(null, {
      id: 'hypothesis_01',
      kind: 'hypothesis',
      label: 'Worker pool starvation',
      status: 'unverified',
      revision: 5,
      payload: {}
    });

    const afterSave = buildNodeEditorSyncKey(null, {
      id: 'hypothesis_01',
      kind: 'hypothesis',
      label: 'Worker pool starvation',
      status: 'confirmed',
      revision: 6,
      payload: {}
    });

    expect(afterSave).not.toBe(beforeSave);
  });

  test('tracks draft nodes independently from saved-node refreshes', () => {
    const draftKey = buildNodeEditorSyncKey({
      id: 'draft_hypothesis_01',
      kind: 'hypothesis',
      parentNodeId: 'problem_01',
      parentKind: 'problem',
      persistedNodeId: null,
      position: { x: 320, y: 160 },
      revision: 0,
      status: 'draft',
      label: 'Hypothesis',
      summary: null,
      payload: {
        statement: 'Unsaved draft'
      }
    }, null);

    expect(draftKey).toBe('draft:draft_hypothesis_01:draft');
  });
});
