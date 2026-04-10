import type { PersistenceDatabaseConnection, PersistenceTransactionConnection } from '@coe/persistence';

export interface InvestigationServerServices {
  db: PersistenceDatabaseConnection;
}

export type InvestigationServerTransaction = PersistenceTransactionConnection;
