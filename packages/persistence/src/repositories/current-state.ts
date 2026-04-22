import { readPersistenceStore, writePersistenceStore, type PersistenceCurrentStateTableName, type PersistenceExecutor } from '../client.js';
import type { JsonValue } from '../schema.js';

export type CurrentStateTableName = PersistenceCurrentStateTableName;

export interface CaseStateRecord {
  id: string;
  title?: string | null;
  severity?: string | null;
  status: string;
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
  constructor(private readonly db: PersistenceExecutor) {}

  async upsertCase(record: CaseStateRecord): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      const existing = store.cases[record.id];
      const now = new Date();
      store.cases[record.id] = {
        id: record.id,
        title: record.title ?? null,
        severity: record.severity ?? null,
        status: record.status,
        revision: record.revision,
        payload: structuredClone(record.payload ?? {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
    });
  }

  async getCase(caseId: string): Promise<CaseStateRecord | undefined> {
    return readPersistenceStore(this.db, (store) => {
      const row = store.cases[caseId];
      if (!row) {
        return undefined;
      }

      return {
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        revision: row.revision,
        payload: structuredClone(row.payload)
      };
    });
  }

  async listCases(): Promise<CaseStateRecord[]> {
    return readPersistenceStore(this.db, (store) =>
      Object.values(store.cases)
        .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
        .map((row) => ({
          id: row.id,
          title: row.title,
          severity: row.severity,
          status: row.status,
          revision: row.revision,
          payload: structuredClone(row.payload)
        }))
    );
  }

  async getHeadRevision(): Promise<number> {
    return readPersistenceStore(this.db, (store) =>
      Object.values(store.cases).reduce((max, record) => Math.max(max, record.revision), 0)
    );
  }

  async upsertRecord(tableName: CurrentStateTableName, record: CurrentStateNodeRecord): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      const existing = store.currentState[tableName][record.id];
      const now = new Date();
      store.currentState[tableName][record.id] = {
        id: record.id,
        caseId: record.caseId,
        revision: record.revision,
        status: record.status ?? null,
        payload: structuredClone(record.payload ?? {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
    });
  }

  async getRecord(tableName: CurrentStateTableName, id: string): Promise<CurrentStateNodeRecord | undefined> {
    return readPersistenceStore(this.db, (store) => {
      const row = store.currentState[tableName][id];
      if (!row) {
        return undefined;
      }

      return {
        id: row.id,
        caseId: row.caseId,
        revision: row.revision,
        status: row.status,
        payload: structuredClone(row.payload)
      };
    });
  }

  async listRecordsByCase(tableName: CurrentStateTableName, caseId: string): Promise<CurrentStateNodeRecord[]> {
    return readPersistenceStore(this.db, (store) =>
      Object.values(store.currentState[tableName])
        .filter((row) => row.caseId === caseId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map((row) => ({
          id: row.id,
          caseId: row.caseId,
          revision: row.revision,
          status: row.status,
          payload: structuredClone(row.payload)
        }))
    );
  }

  async countByCase(tableName: CurrentStateTableName, caseId: string): Promise<number> {
    return readPersistenceStore(this.db, (store) =>
      Object.values(store.currentState[tableName]).filter((row) => row.caseId === caseId).length
    );
  }
}
