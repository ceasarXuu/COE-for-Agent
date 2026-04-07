import { Pool } from 'pg';

export const ADMIN_DATABASE_URL = process.env.COE_PERSISTENCE_ADMIN_DATABASE_URL ?? 'postgresql:///postgres';
export const TEST_DATABASE_NAME = process.env.COE_PERSISTENCE_TEST_DATABASE_NAME ?? 'coe_for_agent_test';
export const TEST_DATABASE_URL =
  process.env.COE_PERSISTENCE_TEST_DATABASE_URL ?? `postgresql:///${TEST_DATABASE_NAME}`;

export function createAdminPool(): Pool {
  return new Pool({
    connectionString: ADMIN_DATABASE_URL,
    max: 1
  });
}

export async function assertPostgresAvailable(pool: Pool): Promise<void> {
  await pool.query('select 1');
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function resetTestDatabase(pool: Pool): Promise<void> {
  await pool.query(
    'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
    [TEST_DATABASE_NAME]
  );
  await pool.query(`drop database if exists ${quoteIdentifier(TEST_DATABASE_NAME)}`);
  await pool.query(`create database ${quoteIdentifier(TEST_DATABASE_NAME)}`);
}