import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

export interface PrepareRealE2ERuntimeOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface RealE2ERuntime {
  runtimeRoot: string;
  dataDir: string;
  artifactRoot: string;
  shouldCleanup: boolean;
  cleanup: () => Promise<void>;
}

export async function prepareRealE2ERuntime(options: PrepareRealE2ERuntimeOptions = {}): Promise<RealE2ERuntime> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const explicitRuntimeRoot = env.REAL_E2E_RUNTIME_ROOT?.trim();
  const tmpRoot = path.join(cwd, '.tmp');

  await mkdir(tmpRoot, { recursive: true });

  const runtimeRoot = explicitRuntimeRoot && explicitRuntimeRoot.length > 0
    ? path.resolve(cwd, explicitRuntimeRoot)
    : await mkdtemp(path.join(tmpRoot, 'investigation-console-real-e2e-'));
  const dataDir = path.join(runtimeRoot, 'data');
  const artifactRoot = path.join(runtimeRoot, 'artifacts');
  const shouldCleanup = !(explicitRuntimeRoot && explicitRuntimeRoot.length > 0);

  await Promise.all([
    mkdir(dataDir, { recursive: true }),
    mkdir(artifactRoot, { recursive: true })
  ]);

  return {
    runtimeRoot,
    dataDir,
    artifactRoot,
    shouldCleanup,
    async cleanup() {
      if (shouldCleanup) {
        await rm(runtimeRoot, { recursive: true, force: true });
      }
    }
  };
}
