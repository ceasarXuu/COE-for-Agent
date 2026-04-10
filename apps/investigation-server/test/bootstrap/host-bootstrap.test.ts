import { describe, expect, test } from 'vitest';
import path from 'node:path';

import {
  buildHostBootstrapPlan,
  createOpenCodeProjectConfig,
  resolveIncludedHosts,
  renderCodexSkillInstall,
  renderStdioLaunchCommand
} from '../../src/bootstrap/host-bootstrap.js';

describe('host bootstrap helpers', () => {
  const repoRoot = '/tmp/coe-for-agent';
  const env = {
    COE_DATA_DIR: './.var/data',
    ARTIFACT_ROOT: './artifacts',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    LOCAL_ISSUER_SECRET: 'dev-local-issuer-secret'
  };

  test('renders a stable stdio launch command for host registration', () => {
    expect(renderStdioLaunchCommand(repoRoot)).toEqual([
      'pnpm',
      '--dir',
      repoRoot,
      '--filter',
      '@coe/investigation-server',
      'exec',
      'node',
      '--import',
      'tsx',
      './src/mcp/stdio-entry.ts'
    ]);
  });

  test('creates a project-scoped OpenCode config with MCP and instructions', () => {
    const config = createOpenCodeProjectConfig(repoRoot, env);

    expect(config).toMatchObject({
      $schema: 'https://opencode.ai/config.json',
      instructions: ['AGENTS.md'],
      mcp: {
        'coe-investigation': {
          type: 'local',
          command: renderStdioLaunchCommand(repoRoot),
          enabled: true,
          environment: expect.objectContaining({
            MCP_TRANSPORT: 'stdio',
            COE_DATA_DIR: path.join(repoRoot, '.var/data')
          })
        }
      }
    });
  });

  test('builds a host plan that includes codex, claude, and opencode setup plus codex skill install', () => {
    const plan = buildHostBootstrapPlan({
      repoRoot,
      env,
      codexHome: '/Users/test/.codex',
      includeHosts: ['codex', 'claude', 'opencode']
    });
    expect(plan.codex).toBeDefined();
    expect(plan.claude).toBeDefined();
    expect(plan.opencode).toBeDefined();

    expect(plan.codex!.registrationCommand).toEqual([
      'codex',
      'mcp',
      'add',
      'coe-investigation',
      '--env',
      `COE_DATA_DIR=${path.join(repoRoot, '.var/data')}`,
      '--env',
      `ARTIFACT_ROOT=${path.join(repoRoot, 'artifacts')}`,
      '--env',
      `OTEL_EXPORTER_OTLP_ENDPOINT=${env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
      '--env',
      `LOCAL_ISSUER_SECRET=${env.LOCAL_ISSUER_SECRET}`,
      '--env',
      'MCP_TRANSPORT=stdio',
      '--',
      ...renderStdioLaunchCommand(repoRoot)
    ]);
    expect(plan.claude!.registrationCommand).toEqual([
      'claude',
      'mcp',
      'add',
      '-s',
      'project',
      'coe-investigation',
      '-e',
      `COE_DATA_DIR=${path.join(repoRoot, '.var/data')}`,
      '-e',
      `ARTIFACT_ROOT=${path.join(repoRoot, 'artifacts')}`,
      '-e',
      `OTEL_EXPORTER_OTLP_ENDPOINT=${env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
      '-e',
      `LOCAL_ISSUER_SECRET=${env.LOCAL_ISSUER_SECRET}`,
      '-e',
      'MCP_TRANSPORT=stdio',
      '--',
      ...renderStdioLaunchCommand(repoRoot)
    ]);
    expect(plan.opencode!.projectConfigPath).toBe('/tmp/coe-for-agent/opencode.json');
    expect(plan.codex!.skillInstall).toEqual(
      renderCodexSkillInstall({
        codexHome: '/Users/test/.codex',
        repoRoot
      })
    );
  });

  test('resolves hosts from detected machine availability when not explicitly requested', () => {
    expect(
      resolveIncludedHosts({
        codex: true,
        claude: false,
        opencode: true
      })
    ).toEqual(['codex', 'opencode']);

    expect(
      resolveIncludedHosts(
        {
          codex: true,
          claude: true,
          opencode: true
        },
        ['claude']
      )
    ).toEqual(['claude']);
  });
});
