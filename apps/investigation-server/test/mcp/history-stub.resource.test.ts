import { describe, expect, test } from 'vitest';

import { loadConfig } from '../../src/config.js';
import { createInvestigationMcpServer } from '../../src/mcp/server.js';

describe('history resources', () => {
  test('registers snapshot, graph, and diff resource surfaces with revision-aware stubs', async () => {
    const server = createInvestigationMcpServer({
      config: loadConfig({})
    });

    expect(server.listResourceTemplates()).toEqual(
      expect.arrayContaining([
        'investigation://cases/{caseId}/snapshot',
        'investigation://cases/{caseId}/timeline',
        'investigation://cases/{caseId}/graph',
        'investigation://cases/{caseId}/diff'
      ])
    );
    expect(server.listResourceTemplates()).not.toEqual(
      expect.arrayContaining([
        'investigation://cases/{caseId}/coverage',
        'investigation://cases/{caseId}/hypotheses/{hypothesisId}',
        'investigation://cases/{caseId}/inquiries/{inquiryId}'
      ])
    );

    const snapshot = await server.readResource(
      'investigation://cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/snapshot?atRevision=12'
    );
    const graph = await server.readResource(
      'investigation://cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/graph?atRevision=12'
    );
    const diff = await server.readResource(
      'investigation://cases/case_01AAAAAAAAAAAAAAAAAAAAAAAA/diff?fromRevision=7&toRevision=12'
    );

    expect(snapshot.data).toMatchObject({
      requestedRevision: 12,
      historical: true
    });
    expect(graph.data).toMatchObject({
      requestedRevision: 12,
      historical: true
    });
    expect(diff.data).toMatchObject({
      data: {
        fromRevision: 7,
        toRevision: 12
      }
    });
  });
});
