import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createTestApp, createAdminPool, assertServerTestDatabaseAvailable, resetServerTestDatabase } from '../test-app.js';
import { DEFAULT_HOST_CONFIG, handleStdioProtocolMessage, type StdioProtocolSessionState } from '../../src/mcp/stdio-protocol.js';

describe.sequential('stdio MCP protocol', () => {
  let state: StdioProtocolSessionState;

  beforeEach(() => {
    state = {
      initialized: false
    };
  });

  test('returns initialize metadata with tools, resources, and prompts capabilities', async () => {
    const response = await handleStdioProtocolMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      },
      {
        server: null,
        state,
        hostConfig: DEFAULT_HOST_CONFIG
      }
    );

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {
          prompts: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          tools: { listChanged: false }
        },
        serverInfo: {
          name: 'coe-investigation',
          version: '0.1.0'
        }
      }
    });
  });

  test('lists prompts and resource templates after initialization', async () => {
    await handleStdioProtocolMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      },
      {
        server: null,
        state,
        hostConfig: DEFAULT_HOST_CONFIG
      }
    );

    await handleStdioProtocolMessage(
      {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      },
      {
        server: null,
        state,
        hostConfig: DEFAULT_HOST_CONFIG
      }
    );

    const promptsResponse = await handleStdioProtocolMessage(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/list'
      },
      {
        server: null,
        state,
        hostConfig: DEFAULT_HOST_CONFIG
      }
    );
    const templatesResponse = await handleStdioProtocolMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/templates/list'
      },
      {
        server: null,
        state,
        hostConfig: DEFAULT_HOST_CONFIG
      }
    );

    expect(promptsResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        prompts: expect.arrayContaining([
          expect.objectContaining({ name: 'coe_investigate_issue' }),
          expect.objectContaining({ name: 'coe_ready_to_patch' }),
          expect.objectContaining({ name: 'coe_reviewer_handoff' })
        ])
      }
    });
    expect(templatesResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        resourceTemplates: expect.arrayContaining([
          expect.objectContaining({ uriTemplate: 'investigation://cases/{caseId}/snapshot' }),
          expect.objectContaining({ uriTemplate: 'investigation://cases/{caseId}/graph' })
        ])
      }
    });
  });

  test('reads profile resources and proxies tool calls through the investigation server', async () => {
    const pool = createAdminPool();
    await assertServerTestDatabaseAvailable(pool);
    await resetServerTestDatabase(pool);

    const app = await createTestApp();

    try {
      await handleStdioProtocolMessage(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        },
        {
          server: app.mcpServer,
          state,
          hostConfig: DEFAULT_HOST_CONFIG
        }
      );
      await handleStdioProtocolMessage(
        {
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        },
        {
          server: app.mcpServer,
          state,
          hostConfig: DEFAULT_HOST_CONFIG
        }
      );

      const resourceResponse = await handleStdioProtocolMessage(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'resources/read',
          params: {
            uri: 'investigation://profile'
          }
        },
        {
          server: app.mcpServer,
          state,
          hostConfig: DEFAULT_HOST_CONFIG
        }
      );

      const toolResponse = await handleStdioProtocolMessage(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'investigation.case.open',
            arguments: {
              idempotencyKey: 'bootstrap-case-open-001',
              title: 'Investigate local bootstrap flow',
              objective: 'Validate stdio MCP transport and local host registration flow',
              severity: 'high',
              environment: ['dev']
            }
          }
        },
        {
          server: app.mcpServer,
          state,
          hostConfig: DEFAULT_HOST_CONFIG
        }
      );

      expect(resourceResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          contents: [
            expect.objectContaining({
              uri: 'investigation://profile',
              mimeType: 'application/json'
            })
          ]
        }
      });
      expect(toolResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: {
          structuredContent: expect.objectContaining({
            headRevisionAfter: 1
          }),
          content: [
            expect.objectContaining({
              type: 'text'
            })
          ]
        }
      });
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
