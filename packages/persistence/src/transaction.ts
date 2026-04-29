import type { LocalPersistenceDatabase } from './database.js';
import type { PersistenceStore } from './types.js';

export class LocalPersistenceTransaction {
  constructor(private readonly runtime: LocalPersistenceDatabase, readonly store: PersistenceStore) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: LocalPersistenceTransaction) => Promise<T>): Promise<T> => callback(this)
    };
  }

  get dataDir(): string {
    return this.runtime.dataDir;
  }
}
