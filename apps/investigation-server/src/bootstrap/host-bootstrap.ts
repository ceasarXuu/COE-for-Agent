import path from 'node:path';

export type SupportedHost = 'codex' | 'claude' | 'opencode';

export interface BootstrapEnv {
  COE_DATA_DIR?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  LOCAL_ISSUER_SECRET?: string;
}

export interface CodexSkillInstallPlan {
  sourcePath: string;
  targetPath: string;
  mode: 'symlink';
}

export interface HostBootstrapPlan {
  codex?: {
    registrationCommand: string[];
    skillInstall: CodexSkillInstallPlan;
  };
  claude?: {
    registrationCommand: string[];
  };
  opencode?: {
    projectConfigPath: string;
    projectConfig: Record<string, unknown>;
  };
}

export function resolveIncludedHosts(
  detectedAvailability: Record<SupportedHost, boolean>,
  requestedHosts?: SupportedHost[]
): SupportedHost[] {
  if (requestedHosts && requestedHosts.length > 0) {
    return requestedHosts.filter((host) => detectedAvailability[host]);
  }

  return (['codex', 'claude', 'opencode'] as const).filter((host) => detectedAvailability[host]);
}

const DEFAULT_ENV: Required<BootstrapEnv> = {
  COE_DATA_DIR: './.var/data',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  LOCAL_ISSUER_SECRET: 'dev-local-issuer-secret'
};

const HOST_NAME = 'coe-investigation';

export function renderStdioLaunchCommand(repoRoot: string): string[] {
  return [
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
  ];
}

export function normalizeBootstrapEnv(env: BootstrapEnv, repoRoot = path.resolve(import.meta.dirname, '../../../../')): Required<BootstrapEnv> {
  const resolveForHost = (value: string) => (path.isAbsolute(value) ? value : path.resolve(repoRoot, value));

  return {
    COE_DATA_DIR: resolveForHost(env.COE_DATA_DIR ?? DEFAULT_ENV.COE_DATA_DIR),
    OTEL_EXPORTER_OTLP_ENDPOINT: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_ENV.OTEL_EXPORTER_OTLP_ENDPOINT,
    LOCAL_ISSUER_SECRET: env.LOCAL_ISSUER_SECRET ?? DEFAULT_ENV.LOCAL_ISSUER_SECRET
  };
}

export function createOpenCodeProjectConfig(repoRoot: string, env: BootstrapEnv): Record<string, unknown> {
  const normalizedEnv = normalizeBootstrapEnv(env, repoRoot);

  return {
    $schema: 'https://opencode.ai/config.json',
    instructions: ['AGENTS.md'],
    mcp: {
      [HOST_NAME]: {
        type: 'local',
        command: renderStdioLaunchCommand(repoRoot),
        enabled: true,
        environment: {
          ...normalizedEnv,
          MCP_TRANSPORT: 'stdio'
        }
      }
    }
  };
}

export function renderCodexSkillInstall(options: { codexHome: string; repoRoot: string }): CodexSkillInstallPlan {
  return {
    sourcePath: path.join(options.repoRoot, '.agents/skills/coe-investigation'),
    targetPath: path.join(options.codexHome, 'skills/coe-investigation'),
    mode: 'symlink'
  };
}

function renderCodexRegistrationCommand(repoRoot: string, env: Required<BootstrapEnv>): string[] {
  return [
    'codex',
    'mcp',
    'add',
    HOST_NAME,
    '--env',
    `COE_DATA_DIR=${env.COE_DATA_DIR}`,
    '--env',
    `OTEL_EXPORTER_OTLP_ENDPOINT=${env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
    '--env',
    `LOCAL_ISSUER_SECRET=${env.LOCAL_ISSUER_SECRET}`,
    '--env',
    'MCP_TRANSPORT=stdio',
    '--',
    ...renderStdioLaunchCommand(repoRoot)
  ];
}

function renderClaudeRegistrationCommand(repoRoot: string, env: Required<BootstrapEnv>): string[] {
  return [
    'claude',
    'mcp',
    'add',
    '-s',
    'project',
    HOST_NAME,
    '-e',
    `COE_DATA_DIR=${env.COE_DATA_DIR}`,
    '-e',
    `OTEL_EXPORTER_OTLP_ENDPOINT=${env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
    '-e',
    `LOCAL_ISSUER_SECRET=${env.LOCAL_ISSUER_SECRET}`,
    '-e',
    'MCP_TRANSPORT=stdio',
    '--',
    ...renderStdioLaunchCommand(repoRoot)
  ];
}

export function buildHostBootstrapPlan(options: {
  repoRoot: string;
  env: BootstrapEnv;
  codexHome: string;
  includeHosts: SupportedHost[];
}): HostBootstrapPlan {
  const normalizedEnv = normalizeBootstrapEnv(options.env, options.repoRoot);
  const include = new Set(options.includeHosts);
  const plan: HostBootstrapPlan = {};

  if (include.has('codex')) {
    plan.codex = {
      registrationCommand: renderCodexRegistrationCommand(options.repoRoot, normalizedEnv),
      skillInstall: renderCodexSkillInstall({
        codexHome: options.codexHome,
        repoRoot: options.repoRoot
      })
    };
  }

  if (include.has('claude')) {
    plan.claude = {
      registrationCommand: renderClaudeRegistrationCommand(options.repoRoot, normalizedEnv)
    };
  }

  if (include.has('opencode')) {
    plan.opencode = {
      projectConfigPath: path.join(options.repoRoot, 'opencode.json'),
      projectConfig: createOpenCodeProjectConfig(options.repoRoot, normalizedEnv)
    };
  }

  return plan;
}
