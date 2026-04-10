import { readPersistenceStore, writePersistenceStore, type PersistenceExecutor } from '../client.js';
import type { JsonValue } from '../schema.js';

export interface CheckpointRecord {
  caseId: string;
  revision: number;
  projectionState: JsonValue;
}

export class CheckpointRepository {
  constructor(private readonly db: PersistenceExecutor) {}

  async save(record: CheckpointRecord): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      if (!store.checkpointsByCase[record.caseId]) {
        store.checkpointsByCase[record.caseId] = {};
      }

      store.checkpointsByCase[record.caseId]![String(record.revision)] = {
        caseId: record.caseId,
        revision: record.revision,
        projectionState: structuredClone(record.projectionState)
      };
    });
  }

  async loadNearest(caseId: string, targetRevision: number): Promise<CheckpointRecord | undefined> {
    return readPersistenceStore(this.db, (store) => {
      const entries = Object.values(store.checkpointsByCase[caseId] ?? {})
        .filter((record) => record.revision <= targetRevision)
        .sort((left, right) => right.revision - left.revision);

      const record = entries[0];
      if (!record) {
        return undefined;
      }

      return {
        caseId: record.caseId,
        revision: record.revision,
        projectionState: structuredClone(record.projectionState)
      };
    });
  }
}
