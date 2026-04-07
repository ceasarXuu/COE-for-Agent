import { describe, expect, test } from 'vitest';

import { loadConfig } from '../../src/config.js';
import { createInvestigationMcpServer } from '../../src/mcp/server.js';

describe('cases resource', () => {
  test('serves the cases collection resource as an empty revision-aware envelope', async () => {
    const server = createInvestigationMcpServer({
      config: loadConfig({})
    });

    const resource = await server.readResource('investigation://cases');
    expect(resource).toMatchObject({
      uri: 'investigation://cases',
      mimeType: 'application/json',
      data: {
        headRevision: 0,
        projectionRevision: 0,
        requestedRevision: null,
        stale: false,
        historical: false,
        data: {
          items: []
        }
      }
    });
  });
});