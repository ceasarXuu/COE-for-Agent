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

  test('lists only canonical write tools after initialization', async () => {
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

    const toolsResponse = await handleStdioProtocolMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list'
      },
      {
        server: null,
        state,
        hostConfig: DEFAULT_HOST_CONFIG
      }
    );

    expect(toolsResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 4,
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'investigation.problem.update' }),
          expect.objectContaining({ name: 'investigation.hypothesis.create' }),
          expect.objectContaining({ name: 'investigation.blocker.open' }),
          expect.objectContaining({ name: 'investigation.repair_attempt.create' }),
          expect.objectContaining({ name: 'investigation.evidence.capture_and_attach' })
        ])
      }
    });

    const toolNames = (((toolsResponse?.result as { tools?: Array<{ name?: string }> } | undefined)?.tools) ?? [])
      .map((tool) => tool.name)
      .filter((name): name is string => typeof name === 'string');

    expect(toolNames).not.toContain('investigation.inquiry.open');
    expect(toolNames).not.toContain('investigation.inquiry.close');
    expect(toolNames).not.toContain('investigation.symptom.report');
    expect(toolNames).not.toContain('investigation.artifact.attach');
    expect(toolNames).not.toContain('investigation.fact.assert');
    expect(toolNames).not.toContain('investigation.hypothesis.propose');
    expect(toolNames).not.toContain('investigation.hypothesis.update_status');
    expect(toolNames).not.toContain('investigation.experiment.plan');
    expect(toolNames).not.toContain('investigation.experiment.record_result');
    expect(toolNames).not.toContain('investigation.gap.open');
    expect(toolNames).not.toContain('investigation.gap.resolve');
    expect(toolNames).not.toContain('investigation.residual.open');
    expect(toolNames).not.toContain('investigation.residual.update');
    expect(toolNames).not.toContain('investigation.decision.record');
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
              projectDirectory: '/workspace/bootstrap-flow'
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
