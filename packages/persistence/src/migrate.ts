import type { PersistenceDatabaseConnection } from './client.js';

export async function migrateToLatest(_db: PersistenceDatabaseConnection): Promise<void> {
  return Promise.resolve();
}
