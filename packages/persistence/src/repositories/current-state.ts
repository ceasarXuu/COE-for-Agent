import { type Kysely, type Transaction } from 'kysely';

import type { JsonValue, PersistenceDatabase } from '../schema.js';

type DatabaseExecutor = Kysely<PersistenceDatabase> | Transaction<PersistenceDatabase>;
export type CurrentStateTableName =
  | 'inquiries'
  | 'entities'
  | 'symptoms'
  | 'artifacts'
  | 'facts'
  | 'hypotheses'
  | 'experiments'
  | 'gaps'
  | 'residuals'
  | 'decisions';

export interface CaseStateRecord {
  id: string;
  title?: string | null;
  severity?: string | null;
  status: string;
  stage: string;
  revision: number;
  payload?: JsonValue;
}

export interface CurrentStateNodeRecord {
  id: string;
  caseId: string;
  revision: number;
  status?: string | null;
  payload?: JsonValue;
}

export class CurrentStateRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async upsertCase(record: CaseStateRecord): Promise<void> {
    await this.db
      .insertInto('cases')
      .values({
        id: record.id,
        title: record.title ?? null,
        severity: record.severity ?? null,
        status: record.status,
        stage: record.stage,
        revision: record.revision,
        payload: record.payload ?? {}
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          title: record.title ?? null,
          severity: record.severity ?? null,
          status: record.status,
          stage: record.stage,
          revision: record.revision,
          payload: record.payload ?? {},
          updated_at: new Date()
        })
      )
      .execute();
  }

  async getCase(caseId: string): Promise<CaseStateRecord | undefined> {
    const row = await this.db
      .selectFrom('cases')
      .select(['id', 'title', 'severity', 'status', 'stage', 'revision', 'payload'])
      .where('id', '=', caseId)
      .executeTakeFirst();

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      stage: row.stage,
      revision: row.revision,
      payload: row.payload
    };
  }

  async upsertRecord(tableName: CurrentStateTableName, record: CurrentStateNodeRecord): Promise<void> {
    await this.db
      .insertInto(tableName)
      .values({
        id: record.id,
        case_id: record.caseId,
        revision: record.revision,
        status: record.status ?? null,
        payload: record.payload ?? {}
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          case_id: record.caseId,
          revision: record.revision,
          status: record.status ?? null,
          payload: record.payload ?? {},
          updated_at: new Date()
        })
      )
      .execute();
  }

  async getRecord(tableName: CurrentStateTableName, id: string): Promise<CurrentStateNodeRecord | undefined> {
    const row = await this.db
      .selectFrom(tableName)
      .select(['id', 'case_id', 'revision', 'status', 'payload'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      caseId: row.case_id,
      revision: row.revision,
      status: row.status,
      payload: row.payload
    };
  }

  async listRecordsByCase(tableName: CurrentStateTableName, caseId: string): Promise<CurrentStateNodeRecord[]> {
    const rows = await this.db
      .selectFrom(tableName)
      .select(['id', 'case_id', 'revision', 'status', 'payload'])
      .where('case_id', '=', caseId)
      .orderBy('created_at', 'asc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      revision: row.revision,
      status: row.status,
      payload: row.payload
    }));
  }

  async countByCase(tableName: CurrentStateTableName, caseId: string): Promise<number> {
    const row = await this.db
      .selectFrom(tableName)
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('case_id', '=', caseId)
      .executeTakeFirstOrThrow();

    return Number(row.count);
  }
}