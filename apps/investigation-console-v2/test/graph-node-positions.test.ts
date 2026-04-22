import { describe, expect, test } from 'vitest';

import {
  buildGraphNodePositionStorageKey,
  mergeGraphNodePositions,
  readGraphNodePositions,
  upsertGraphNodePosition
} from '../src/lib/workspace/graph-node-positions.js';

describe('graph node positions', () => {
  test('merges saved positions over computed layout positions', () => {
    const merged = mergeGraphNodePositions(
      [
        { id: 'problem_01', position: { x: 40, y: 80 } },
        { id: 'hypothesis_01', position: { x: 320, y: 80 } }
      ],
      {
        problem_01: { x: 440, y: 280 }
      }
    );

    expect(merged).toEqual([
      { id: 'problem_01', position: { x: 440, y: 280 } },
      { id: 'hypothesis_01', position: { x: 320, y: 80 } }
    ]);
  });

  test('reads and validates stored graph positions by case and revision key', () => {
    const storageKey = buildGraphNodePositionStorageKey({
      caseId: 'case_01',
      requestedRevision: null
    });
    const storage = {
      getItem(key: string) {
        if (key !== storageKey) {
          return null;
        }

        return JSON.stringify({
          hypothesis_01: { x: 512, y: 144 },
          bad: { x: 'nope', y: 2 }
        });
      }
    };

    expect(readGraphNodePositions(storage, storageKey)).toEqual({
      hypothesis_01: { x: 512, y: 144 }
    });
  });

  test('upserts node position entries without dropping prior nodes', () => {
    expect(
      upsertGraphNodePosition(
        {
          problem_01: { x: 40, y: 80 }
        },
        'hypothesis_01',
        { x: 320, y: 120 }
      )
    ).toEqual({
      problem_01: { x: 40, y: 80 },
      hypothesis_01: { x: 320, y: 120 }
    });
  });
});
