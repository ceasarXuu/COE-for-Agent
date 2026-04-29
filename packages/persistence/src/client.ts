import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';

import { LocalPersistenceDatabase } from './database.js';
import type { CreatePersistenceClientOptions } from './types.js';

export type { CreatePersistenceClientOptions } from './types.js';
export type {
  PersistenceCurrentStateTableName,
  PersistenceStore,
  StoredCaseListProjectionRecord,
  StoredCaseRecord,
  StoredCheckpointRecord,
  StoredCurrentStateRecord,
  StoredDedupRecord,
  StoredEvent,
  StoredOutboxRecord
} from './types.js';
export { LocalPersistenceDatabase } from './database.js';
export { LocalPersistenceTransaction } from './transaction.js';
export {
  isPersistenceTransaction,
  readPersistenceStore,
  writePersistenceStore
} from './executor.js';
export type {
  PersistenceDatabaseConnection,
  PersistenceExecutor,
  PersistenceTransactionConnection
} from './executor.js';

export interface PersistenceClient {
  dataDir: string;
  db: LocalPersistenceDatabase;
  destroy(): Promise<void>;
}

export function createPersistenceClient({ dataDir }: CreatePersistenceClientOptions = {}): PersistenceClient {
  const resolvedDataDir = dataDir ?? path.resolve(process.cwd(), '.var/data');
  const db = new LocalPersistenceDatabase(resolvedDataDir);

  return {
    dataDir: resolvedDataDir,
    db,
    async destroy() {
      await db.destroy();
    }
  };
}

export function resetPersistenceDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    return;
  }

  const backupPath = `${dataDir}.backup-${Date.now()}`;
  renameSync(dataDir, backupPath);
  console.info('[persistence] data-dir.moved-for-reset', {
    event: 'persistence.data_dir_moved_for_reset',
    dataDir,
    backupPath
  });
}
