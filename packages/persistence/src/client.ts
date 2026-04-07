import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { PersistenceDatabase } from './schema.js';

export interface PersistenceClient {
  pool: Pool;
  db: Kysely<PersistenceDatabase>;
  destroy(): Promise<void>;
}

export interface CreatePersistenceClientOptions {
  connectionString: string;
}

export function createPersistenceClient({ connectionString }: CreatePersistenceClientOptions): PersistenceClient {
  const pool = new Pool({
    connectionString,
    max: 10
  });

  const db = new Kysely<PersistenceDatabase>({
    dialect: new PostgresDialect({
      pool
    })
  });

  return {
    pool,
    db,
    async destroy() {
      await db.destroy();
    }
  };
}