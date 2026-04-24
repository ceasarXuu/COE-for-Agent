import { mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createTestDataDir(): string {
  const parentDir = process.env.COE_PERSISTENCE_TEST_DATA_DIR ?? os.tmpdir();
  mkdirSync(parentDir, { recursive: true });
  return mkdtempSync(path.join(parentDir, 'coe_for_agent_persistence_test-'));
}

let currentTestDataDir = createTestDataDir();

export function getTestDataDir(): string {
  return currentTestDataDir;
}

export function createLocalPersistenceTestHandle() {
  return {
    async end(): Promise<void> {
      return Promise.resolve();
    }
  };
}

export async function assertLocalPersistenceAvailable(_handle: ReturnType<typeof createLocalPersistenceTestHandle>): Promise<void> {
  return Promise.resolve();
}

export async function resetLocalPersistenceDataDir(
  _handle: ReturnType<typeof createLocalPersistenceTestHandle>
): Promise<void> {
  currentTestDataDir = createTestDataDir();
  console.info('[persistence-test] local-data-dir.created', {
    event: 'persistence_test.local_data_dir_created',
    dataDir: currentTestDataDir
  });
}
