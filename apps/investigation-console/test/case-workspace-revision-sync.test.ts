import { describe, expect, test } from 'vitest';

import { workspaceMatchesRouteRevision } from '../src/routes/case-workspace-revision-sync.js';

function envelope(input: { headRevision: number; requestedRevision: number | null }) {
  return {
    headRevision: input.headRevision,
    projectionRevision: input.headRevision,
    requestedRevision: input.requestedRevision,
    stale: false,
    historical: input.requestedRevision !== null,
    data: {}
  };
}

describe('case workspace revision sync', () => {
  test('rejects head workspace data while the route is asking for a historical revision', () => {
    expect(workspaceMatchesRouteRevision({
      snapshot: envelope({ headRevision: 3, requestedRevision: null }),
      timeline: envelope({ headRevision: 3, requestedRevision: null }),
      graph: envelope({ headRevision: 3, requestedRevision: null })
    }, 2)).toBe(false);
  });

  test('accepts all workspace resources when they match the requested historical revision', () => {
    expect(workspaceMatchesRouteRevision({
      snapshot: envelope({ headRevision: 3, requestedRevision: 2 }),
      timeline: envelope({ headRevision: 3, requestedRevision: 2 }),
      graph: envelope({ headRevision: 3, requestedRevision: 2 })
    }, 2)).toBe(true);
  });

  test('accepts head resources when the route is in head mode', () => {
    expect(workspaceMatchesRouteRevision({
      snapshot: envelope({ headRevision: 3, requestedRevision: null }),
      timeline: envelope({ headRevision: 3, requestedRevision: null }),
      graph: envelope({ headRevision: 3, requestedRevision: null })
    }, null)).toBe(true);
  });

  test('treats route revisions at or beyond head as head resources', () => {
    expect(workspaceMatchesRouteRevision({
      snapshot: envelope({ headRevision: 3, requestedRevision: null }),
      timeline: envelope({ headRevision: 3, requestedRevision: null }),
      graph: envelope({ headRevision: 3, requestedRevision: null })
    }, 3)).toBe(true);
  });
});
