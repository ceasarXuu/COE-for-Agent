import type { PersistenceDatabaseConnection } from './client.js';

/**
 * No-op migration entry point.
 *
 * The MVP persistence layer is JSON-file based (see CaseStore) and does not
 * use a SQL migration runner. This function is preserved as a stable seam so
 * tests can express "ensure storage is initialized" without coupling to the
 * underlying engine. If a SQL backend is reintroduced, the implementation can
 * be filled in here without touching call sites.
 */
export async function migrateToLatest(_db: PersistenceDatabaseConnection): Promise<void> {
  return Promise.resolve();
}
