import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  buildHostBootstrapPlan,
  normalizeBootstrapEnv,
  resolveIncludedHosts,
  type BootstrapEnv,
  type SupportedHost
} from './host-bootstrap.js';

function parseArgs(argv: string[]) {
  const args = new Set(argv);
  const hostFlag = argv.find((value) => value.startsWith('--hosts='));
  const requestedHosts = hostFlag
    ? hostFlag.replace('--hosts=', '').split(',').map((value) => value.trim()).filter(Boolean) as SupportedHost[]
    : undefined;
  const repoRoot = path.resolve(import.meta.dirname, '../../../../');

  return {
    apply: args.has('--apply'),
    requestedHosts,
    repoRoot
  };
}

function parseEnvFile(filePath: string): BootstrapEnv {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return Object.fromEntries(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
  ) as BootstrapEnv;
}

function detectBootstrapEnv(repoRoot: string): Required<BootstrapEnv> {
  const localEnv = parseEnvFile(path.join(repoRoot, '.env'));
  const exampleEnv = parseEnvFile(path.join(repoRoot, '.env.example'));
  return normalizeBootstrapEnv({
    ...exampleEnv,
    ...localEnv
  });
}

function ensureCommandAvailable(command: string): void {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`Required command is not available: ${command}`);
  }
}

function hasCommand(command: string): boolean {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

function runCommand(command: string[], cwd?: string): void {
  const result = spawnSync(command[0]!, command.slice(1), {
    stdio: 'inherit',
    ...(cwd ? { cwd } : {})
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command.join(' ')}`);
  }
}

function runCommandAllowFailure(command: string[], cwd?: string): void {
  spawnSync(command[0]!, command.slice(1), {
    stdio: 'ignore',
    ...(cwd ? { cwd } : {})
  });
}

function ensureCodexSkillSymlink(sourcePath: string, targetPath: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
  fs.symlinkSync(sourcePath, targetPath, 'dir');
}

function writeOpenCodeConfig(filePath: string, config: Record<string, unknown>): void {
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function removeFileIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function printPlan(plan: ReturnType<typeof buildHostBootstrapPlan>): void {
  process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = detectBootstrapEnv(args.repoRoot);
  const codexHome = process.env.CODEX_HOME ?? path.join(process.env.HOME ?? '', '.codex');
  const hosts = resolveIncludedHosts(
    {
      codex: hasCommand('codex'),
      claude: hasCommand('claude'),
      opencode: hasCommand('opencode')
    },
    args.requestedHosts
  );
  const plan = buildHostBootstrapPlan({
    repoRoot: args.repoRoot,
    env,
    codexHome,
    includeHosts: hosts
  });

  if (!args.apply) {
    printPlan(plan);
    return;
  }

  ensureCommandAvailable('pnpm');

  if (plan.codex) {
    ensureCommandAvailable('codex');
    runCommandAllowFailure(['codex', 'mcp', 'remove', 'coe-investigation']);
    runCommand(plan.codex.registrationCommand);
    ensureCodexSkillSymlink(plan.codex.skillInstall.sourcePath, plan.codex.skillInstall.targetPath);
  }

  if (plan.claude) {
    ensureCommandAvailable('claude');
    removeFileIfExists(path.join(args.repoRoot, 'apps/investigation-server/.mcp.json'));
    runCommandAllowFailure(['claude', 'mcp', 'remove', '-s', 'project', 'coe-investigation'], args.repoRoot);
    runCommand(plan.claude.registrationCommand, args.repoRoot);
  }

  if (plan.opencode) {
    writeOpenCodeConfig(plan.opencode.projectConfigPath, plan.opencode.projectConfig);
  }

  printPlan(plan);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
