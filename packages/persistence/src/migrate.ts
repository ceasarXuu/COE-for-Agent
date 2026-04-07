import { readFileSync } from 'node:fs';

import { sql, type Kysely } from 'kysely';

import type { PersistenceDatabase } from './schema.js';

const migrationFile = new URL('../migrations/0001_init.sql', import.meta.url);

function splitSqlStatements(source: string): string[] {
  return source
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function migrateToLatest(db: Kysely<PersistenceDatabase>): Promise<void> {
  const migrationSql = readFileSync(migrationFile, 'utf8');

  for (const statement of splitSqlStatements(migrationSql)) {
    await sql.raw(statement).execute(db);
  }
}