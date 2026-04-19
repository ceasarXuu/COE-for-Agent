import { RESOURCE_URI_TEMPLATES } from '@coe/mcp-contracts/resource-uris';

import { loadConfig } from '../config.js';

import { PROMPT_DEFINITIONS, findPromptDefinition } from './prompts.js';
import { createInvestigationMcpServer, type InvestigationMcpServer } from './server.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface StdioProtocolSessionState {
  initialized: boolean;
}

export interface HostProtocolConfig {
  protocolVersion: string;
  serverName: string;
  serverTitle: string;
  version: string;
  instructions: string;
}

export const DEFAULT_HOST_CONFIG: HostProtocolConfig = {
  protocolVersion: '2025-06-18',
  serverName: 'coe-investigation',
  serverTitle: 'COE Investigation',
  version: '0.1.0',
  instructions:
    'Use COE investigation tools to maintain a strict canonical case graph of problem, hypothesis, blocker, repair attempt, and evidence. ' +
    'Do not create repair attempts before a hypothesis is confirmed.'
};

const RESOURCE_METADATA_BY_TEMPLATE: Record<string, { name: string; title: string; description: string }> = {
  [RESOURCE_URI_TEMPLATES.profile]: {
    name: 'profile',
    title: 'Investigation Profile',
    description: 'Capability metadata for the COE investigation MCP surface.'
  },
  [RESOURCE_URI_TEMPLATES.cases]: {
    name: 'cases',
    title: 'Case List',
    description: 'Collection resource for investigation cases.'
  },
  [RESOURCE_URI_TEMPLATES.snapshot]: {
    name: 'case-snapshot',
    title: 'Case Snapshot',
    description: 'Revision-aware case overview and key counts.'
  },
  [RESOURCE_URI_TEMPLATES.timeline]: {
    name: 'case-timeline',
    title: 'Case Timeline',
    description: 'Chronological event history for a case.'
  },
  [RESOURCE_URI_TEMPLATES.graph]: {
    name: 'case-graph',
    title: 'Case Graph',
    description: 'Canonical case graph slice of problem, hypotheses, blockers, repair attempts, and evidence references.'
  },
  [RESOURCE_URI_TEMPLATES.evidencePool]: {
    name: 'case-evidence-pool',
    title: 'Case Evidence Pool',
    description: 'Reusable canonical evidence entities captured for a case.'
  },
  [RESOURCE_URI_TEMPLATES.diff]: {
    name: 'case-diff',
    title: 'Case Diff',
    description: 'Revision diff for changed nodes, edges, and transitions.'
  }
};

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function response(id: string | number | null, result: Record<string, unknown>): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function errorResponse(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data })
    }
  };
}

function requiresInitialization(method: string): boolean {
  return method !== 'initialize' && method !== 'ping' && method !== 'notifications/initialized';
}

function buildPromptList() {
  return PROMPT_DEFINITIONS.map((prompt) => ({
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    ...(prompt.arguments ? { arguments: prompt.arguments } : {})
  }));
}

function buildResourceList(server: InvestigationMcpServer) {
  return server
    .listResourceTemplates()
    .filter((template) => !template.includes('{'))
    .map((template) => ({
      uri: template,
      ...RESOURCE_METADATA_BY_TEMPLATE[template]
    }));
}

function buildResourceTemplateList(server: InvestigationMcpServer) {
  return server
    .listResourceTemplates()
    .filter((template) => template.includes('{'))
    .map((template) => ({
      uriTemplate: template,
      ...RESOURCE_METADATA_BY_TEMPLATE[template]
    }));
}

function getServer(server: InvestigationMcpServer | null | undefined): InvestigationMcpServer {
  if (server) {
    return server;
  }

  return createInvestigationMcpServer({
    config: loadConfig({
      MCP_TRANSPORT: 'stdio'
    })
  });
}

function stringifyData(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export async function handleStdioProtocolMessage(
  message: JsonRpcRequest,
  options: {
    server?: InvestigationMcpServer | null;
    state: StdioProtocolSessionState;
    hostConfig?: HostProtocolConfig;
  }
): Promise<JsonRpcResponse | null> {
  const hostConfig = options.hostConfig ?? DEFAULT_HOST_CONFIG;
  const server = getServer(options.server);
  const id = message.id ?? null;

  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return errorResponse(id, -32600, 'Invalid Request');
  }

  if (requiresInitialization(message.method) && !options.state.initialized) {
    return errorResponse(id, -32002, 'Server not initialized');
  }

  switch (message.method) {
    case 'initialize':
      return response(id, {
        protocolVersion: hostConfig.protocolVersion,
        capabilities: {
          prompts: {
            listChanged: false
          },
          resources: {
            subscribe: false,
            listChanged: false
          },
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: hostConfig.serverName,
          title: hostConfig.serverTitle,
          version: hostConfig.version
        },
        instructions: hostConfig.instructions
      });
    case 'notifications/initialized':
      options.state.initialized = true;
      return null;
    case 'ping':
      return response(id, {});
    case 'tools/list':
      return response(id, {
        tools: server.listTools().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      });
    case 'tools/call': {
      const params = asObject(message.params);
      const name = typeof params.name === 'string' ? params.name : '';
      const args = asObject(params.arguments);

      try {
        const result = await server.invokeTool(name as never, args as never);
        return response(id, {
          content: [
            {
              type: 'text',
              text: stringifyData(result)
            }
          ],
          structuredContent: result
        });
      } catch (error) {
        return response(id, {
          isError: true,
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown tool error'
            }
          ]
        });
      }
    }
    case 'resources/list':
      return response(id, {
        resources: buildResourceList(server)
      });
    case 'resources/templates/list':
      return response(id, {
        resourceTemplates: buildResourceTemplateList(server)
      });
    case 'resources/read': {
      const params = asObject(message.params);
      const uri = typeof params.uri === 'string' ? params.uri : '';
      if (!uri) {
        return errorResponse(id, -32602, 'uri is required');
      }

      try {
        const result = await server.readResource(uri);
        return response(id, {
          contents: [
            {
              uri: result.uri,
              mimeType: result.mimeType,
              text: stringifyData(result.data)
            }
          ]
        });
      } catch (error) {
        return errorResponse(id, -32004, error instanceof Error ? error.message : 'Resource read failed');
      }
    }
    case 'prompts/list':
      return response(id, {
        prompts: buildPromptList()
      });
    case 'prompts/get': {
      const params = asObject(message.params);
      const name = typeof params.name === 'string' ? params.name : '';
      const prompt = findPromptDefinition(name);

      if (!prompt) {
        return errorResponse(id, -32602, `Unknown prompt: ${name}`);
      }

      const args = asObject(params.arguments);
      const stringArgs = Object.fromEntries(
        Object.entries(args)
          .filter(([, value]) => typeof value === 'string')
          .map(([key, value]) => [key, String(value)])
      );

      return response(id, {
        description: prompt.description,
        messages: prompt.buildMessages(stringArgs)
      });
    }
    default:
      return errorResponse(id, -32601, `Method not found: ${message.method}`);
  }
}
