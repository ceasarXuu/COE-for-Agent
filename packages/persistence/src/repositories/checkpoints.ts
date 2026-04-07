import { type Kysely } from 'kysely';

import type { JsonValue, PersistenceDatabase } from '../schema.js';

export interface CheckpointRecord {
  caseId: string;
  revision: number;
  projectionState: JsonValue;
}

export class CheckpointRepository {
  constructor(private readonly db: Kysely<PersistenceDatabase>) {}

  async save(record: CheckpointRecord): Promise<void> {
    await this.db
      .insertInto('case_projection_checkpoints')
      .values({
        case_id: record.caseId,
        revision: record.revision,
        projection_state: record.projectionState
      })
      .onConflict((oc) =>
        oc.columns(['case_id', 'revision']).doUpdateSet({
          projection_state: record.projectionState
        })
      )
      .execute();
  }

  async loadNearest(caseId: string, targetRevision: number): Promise<CheckpointRecord | undefined> {
    const row = await this.db
      .selectFrom('case_projection_checkpoints')
      .select(['case_id', 'revision', 'projection_state'])
      .where('case_id', '=', caseId)
      .where('revision', '<=', targetRevision)
      .orderBy('revision', 'desc')
      .executeTakeFirst();

    if (!row) {
      return undefined;
    }

    return {
      caseId: row.case_id,
      revision: row.revision,
      projectionState: row.projection_state
    };
  }
}