import { describe, expect, test } from 'vitest';

import { RevisionConflict, assertRevisionMatch } from '../src/revision.js';
import { createResourceEnvelope } from '../src/resource-envelope.js';

describe('revision and resource envelope', () => {
  test('throws revision conflict when expected revision does not match actual revision', () => {
    expect(() => assertRevisionMatch('case_01ABCDEF0123456789ABCDEF01', 3, 4)).toThrow(RevisionConflict);
  });

  test('creates revision-aware resource envelopes with required fields', () => {
    const envelope = createResourceEnvelope({
      headRevision: 12,
      projectionRevision: 11,
      requestedRevision: 10,
      data: {
        ok: true
      }
    });

    expect(envelope).toEqual({
      headRevision: 12,
      projectionRevision: 11,
      requestedRevision: 10,
      stale: true,
      historical: true,
      data: {
        ok: true
      }
    });
  });
});