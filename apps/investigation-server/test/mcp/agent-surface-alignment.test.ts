import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { GUARDRAIL_TOOL_NAMES, MUTATION_TOOL_NAMES } from '@coe/mcp-contracts/tool-names';
import { RESOURCE_URI_TEMPLATES } from '@coe/mcp-contracts/resource-uris';
import { describe, expect, test } from 'vitest';

import { PROMPT_DEFINITIONS } from '../../src/mcp/prompts.js';
import {
  DEFAULT_HOST_CONFIG,
  handleStdioProtocolMessage,
  type JsonRpcResponse,
  type StdioProtocolSessionState
} from '../../src/mcp/stdio-protocol.js';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const allToolNames = [...MUTATION_TOOL_NAMES, ...GUARDRAIL_TOOL_NAMES];
const allResourceTemplates = Object.values(RESOURCE_URI_TEMPLATES);
const allToolNameStrings = allToolNames as readonly string[];
const allResourceTemplateStrings = allResourceTemplates as readonly string[];

const forbiddenAgentSurfacePatterns = [
  /investigation\.inquiry\./,
  /investigation\.symptom\./,
  /investigation\.artifact\.attach/,
  /investigation\.fact\./,
  /investigation\.experiment\./,
  /investigation\.gap\./,
  /investigation\.residual\./,
  /investigation\.decision\./,
  /investigation\.issue\./,
  /investigation:\/\/cases\/[^)\s`]+\/coverage/,
  /@coe\/investigation-server\/src/,
  /getDefaultSession\(\)\.sessionToken/
];

const forbiddenCurrentDocPatterns = [
  ...forbiddenAgentSurfacePatterns,
  /\bPostgreSQL\b/i,
  /\bPostgres\b/i,
  /\bKysely\b/,
  /apps\/investigation-console(?!-v2)/,
  /19 个变更型/,
  /17 个变更型/,
  /9 个 resource/,
  /fallback session/i,
  /displayKind/,
  /issueKind/,
  /projectionModel.*legacy/
];

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : collectMarkdownFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

function readAgentGuidanceFiles(): Array<{ path: string; text: string }> {
  const files = [
    join(repoRoot, '.agents/skills/coe-investigation/SKILL.md'),
    ...collectMarkdownFiles(join(repoRoot, '.claude/commands')),
    ...collectMarkdownFiles(join(repoRoot, '.opencode/commands'))
  ];

  return files.sort().map((path) => ({ path, text: readText(path) }));
}

function readCurrentDocs(): Array<{ path: string; text: string }> {
  const files = [
    join(repoRoot, 'README.md'),
    join(repoRoot, 'docs/案件图草稿.md'),
    ...collectMarkdownFiles(join(repoRoot, 'docs'))
  ];

  return files.sort().map((path) => ({ path, text: readText(path) }));
}

function expectNoForbiddenPatterns(text: string, patterns: RegExp[], label: string): void {
  for (const pattern of patterns) {
    expect(text, `${label} contains forbidden pattern ${pattern}`).not.toMatch(pattern);
  }
}

function extractToolRefs(text: string): string[] {
  return [...text.matchAll(/investigation\.[a-z_]+(?:\.[a-z_]+)+/g)].map((match) => match[0]);
}

function extractResourceRefs(text: string): string[] {
  return [...text.matchAll(/investigation:\/\/[A-Za-z0-9_./{}$-]+/g)].map((match) => normalizeResourceRef(match[0]));
}

function normalizeResourceRef(ref: string): string {
  return ref.replace(/[.,;:]+$/, '')
    .replace('/$ARGUMENTS/', '/{caseId}/')
    .replace(/investigation:\/\/cases\/[^/]+\/(snapshot|timeline|graph|evidence-pool|diff)/, 'investigation://cases/{caseId}/$1');
}

async function protocolCall(
  state: StdioProtocolSessionState,
  message: Parameters<typeof handleStdioProtocolMessage>[0]
): Promise<JsonRpcResponse | null> {
  return handleStdioProtocolMessage(message, {
    server: null,
    state,
    hostConfig: DEFAULT_HOST_CONFIG
  });
}

async function initializeProtocol(): Promise<StdioProtocolSessionState> {
  const state = { initialized: false };
  await protocolCall(state, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'agent-surface-alignment-test',
        version: '1.0.0'
      }
    }
  });
  await protocolCall(state, {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
  return state;
}

function resultArray<T>(response: JsonRpcResponse | null, key: string): T[] {
  const result = response?.result ?? {};
  const value = result[key];
  return Array.isArray(value) ? value as T[] : [];
}

describe('agent-facing MCP surface alignment', () => {
  test('contracts expose the expected canonical tool counts', () => {
    expect(MUTATION_TOOL_NAMES).toHaveLength(18);
    expect(GUARDRAIL_TOOL_NAMES).toHaveLength(4);
    expect(new Set(allToolNames).size).toBe(allToolNames.length);
  });

  test('stdio metadata exposes every canonical tool, resource, and prompt', async () => {
    const state = await initializeProtocol();

    const toolsResponse = await protocolCall(state, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    const resourcesResponse = await protocolCall(state, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list'
    });
    const resourceTemplatesResponse = await protocolCall(state, {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/templates/list'
    });
    const promptsResponse = await protocolCall(state, {
      jsonrpc: '2.0',
      id: 5,
      method: 'prompts/list'
    });

    const toolNames = resultArray<{ name: string }>(toolsResponse, 'tools').map((tool) => tool.name).sort();
    const resourceUris = resultArray<{ uri: string }>(resourcesResponse, 'resources').map((resource) => resource.uri).sort();
    const resourceTemplateUris = resultArray<{ uriTemplate: string }>(resourceTemplatesResponse, 'resourceTemplates')
      .map((resource) => resource.uriTemplate)
      .sort();
    const promptNames = resultArray<{ name: string }>(promptsResponse, 'prompts').map((prompt) => prompt.name).sort();

    expect(toolNames).toEqual([...allToolNames].sort());
    expect(resourceUris).toEqual([RESOURCE_URI_TEMPLATES.profile, RESOURCE_URI_TEMPLATES.cases].sort());
    expect(resourceTemplateUris).toEqual([
      RESOURCE_URI_TEMPLATES.snapshot,
      RESOURCE_URI_TEMPLATES.timeline,
      RESOURCE_URI_TEMPLATES.graph,
      RESOURCE_URI_TEMPLATES.evidencePool,
      RESOURCE_URI_TEMPLATES.diff
    ].sort());
    expect(promptNames).toEqual(PROMPT_DEFINITIONS.map((prompt) => prompt.name).sort());
  });

  test('agent skills and command files reference only published MCP names', () => {
    const validTools = new Set<string>(allToolNames);
    const validResources = new Set<string>(allResourceTemplates);

    for (const file of readAgentGuidanceFiles()) {
      expectNoForbiddenPatterns(file.text, forbiddenAgentSurfacePatterns, file.path);
      for (const toolRef of extractToolRefs(file.text)) {
        expect(validTools.has(toolRef), `${file.path} references unknown tool ${toolRef}`).toBe(true);
      }
      for (const resourceRef of extractResourceRefs(file.text)) {
        expect(validResources.has(resourceRef), `${file.path} references unknown resource ${resourceRef}`).toBe(true);
      }
    }
  });

  test('host instructions and prompts are usable by an agent without stale surface references', () => {
    expectNoForbiddenPatterns(DEFAULT_HOST_CONFIG.instructions, forbiddenAgentSurfacePatterns, 'host instructions');
    expect(DEFAULT_HOST_CONFIG.instructions).toContain(RESOURCE_URI_TEMPLATES.profile);
    expect(DEFAULT_HOST_CONFIG.instructions).toContain('evidence-pool');

    const promptText = PROMPT_DEFINITIONS.flatMap((prompt) => prompt.buildMessages({
      problem: 'agent surface alignment',
      environment: 'test',
      caseId: 'case_01AGENTSURFACEALIGNMENT001'
    }).map((message) => message.content.text)).join('\n');

    expectNoForbiddenPatterns(promptText, forbiddenAgentSurfacePatterns, 'prompt text');
    for (const toolRef of extractToolRefs(promptText)) {
      expect(allToolNameStrings).toContain(toolRef);
    }
    for (const resourceRef of extractResourceRefs(promptText)) {
      expect(allResourceTemplateStrings).toContain(resourceRef);
    }
  });

  test('current docs do not advertise removed runtime contracts', () => {
    for (const file of readCurrentDocs()) {
      expectNoForbiddenPatterns(file.text, forbiddenCurrentDocPatterns, file.path);
    }
  });
});
