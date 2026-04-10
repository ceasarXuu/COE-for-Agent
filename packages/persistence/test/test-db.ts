import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TEST_DATABASE_URL =
  process.env.COE_PERSISTENCE_TEST_DATA_DIR ?? path.join(os.tmpdir(), 'coe_for_agent_test');

export function createAdminPool() {
  return {
    async end(): Promise<void> {
      return Promise.resolve();
    }
  };
}

export async function assertPostgresAvailable(_pool: ReturnType<typeof createAdminPool>): Promise<void> {
  return Promise.resolve();
}

export async function resetTestDatabase(_pool: ReturnType<typeof createAdminPool>): Promise<void> {
  rmSync(TEST_DATABASE_URL, { recursive: true, force: true });
  mkdirSync(TEST_DATABASE_URL, { recursive: true });
}
