import { LocalPersistenceDatabase } from './database.js';
import { LocalPersistenceTransaction } from './transaction.js';
import type { PersistenceStore } from './types.js';

export type PersistenceDatabaseConnection = LocalPersistenceDatabase;
export type PersistenceTransactionConnection = LocalPersistenceTransaction;
export type PersistenceExecutor = PersistenceDatabaseConnection | PersistenceTransactionConnection;

export function isPersistenceTransaction(executor: PersistenceExecutor): executor is PersistenceTransactionConnection {
  return executor instanceof LocalPersistenceTransaction;
}

export async function readPersistenceStore<T>(
  executor: PersistenceExecutor,
  reader: (store: PersistenceStore) => T | Promise<T>
): Promise<T> {
  const store = isPersistenceTransaction(executor) ? executor.store : await executor.readStore();
  return reader(store);
}

export async function writePersistenceStore<T>(
  executor: PersistenceExecutor,
  writer: (store: PersistenceStore) => T | Promise<T>
): Promise<T> {
  if (isPersistenceTransaction(executor)) {
    return writer(executor.store);
  }

  return executor.transaction().execute(async (trx) => writer(trx.store));
}
