import { type Kysely, type Transaction } from 'kysely';

import type { PersistenceDatabase } from '../schema.js';

type DatabaseExecutor = Kysely<PersistenceDatabase> | Transaction<PersistenceDatabase>;

export interface CaseListProjectionRecord {
  caseId: string;
  title?: string | null;
  summary?: string | null;
  severity?: string | null;
  status?: string | null;
  stage?: string | null;
  activeHypothesisCount?: number;
  openGapCount?: number;
  openResidualCount?: number;
  stallRisk?: string | null;
}

export interface ListCaseProjectionQuery {
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface ListedCaseProjectionRecord extends CaseListProjectionRecord {
  headRevision: number;
  updatedAt: Date;
}

export class CaseListProjectionRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  async upsert(record: CaseListProjectionRecord): Promise<void> {
    await this.db
      .insertInto('case_list_projection')
      .values({
        case_id: record.caseId,
        title: record.title ?? null,
        summary: record.summary ?? null,
        severity: record.severity ?? null,
        status: record.status ?? null,
        stage: record.stage ?? null,
        active_hypothesis_count: record.activeHypothesisCount ?? 0,
        open_gap_count: record.openGapCount ?? 0,
        open_residual_count: record.openResidualCount ?? 0,
        stall_risk: record.stallRisk ?? null
      })
      .onConflict((oc) =>
        oc.column('case_id').doUpdateSet({
          title: record.title ?? null,
          summary: record.summary ?? null,
          severity: record.severity ?? null,
          status: record.status ?? null,
          stage: record.stage ?? null,
          active_hypothesis_count: record.activeHypothesisCount ?? 0,
          open_gap_count: record.openGapCount ?? 0,
          open_residual_count: record.openResidualCount ?? 0,
          stall_risk: record.stallRisk ?? null,
          updated_at: new Date()
        })
      )
      .execute();
  }

  async list(query: ListCaseProjectionQuery = {}): Promise<ListedCaseProjectionRecord[]> {
    const rows = await this.db
      .selectFrom('case_list_projection')
      .leftJoin('cases', 'cases.id', 'case_list_projection.case_id')
      .select([
        'case_list_projection.case_id',
        'case_list_projection.title',
        'case_list_projection.summary',
        'case_list_projection.severity',
        'case_list_projection.status',
        'case_list_projection.stage',
        'case_list_projection.active_hypothesis_count',
        'case_list_projection.open_gap_count',
        'case_list_projection.open_residual_count',
        'case_list_projection.stall_risk',
        'case_list_projection.updated_at',
        'cases.revision'
      ])
      .execute();

    let items = rows.map((row) => ({
      caseId: row.case_id,
      title: row.title,
      summary: row.summary,
      severity: row.severity,
      status: row.status,
      stage: row.stage,
      activeHypothesisCount: row.active_hypothesis_count,
      openGapCount: row.open_gap_count,
      openResidualCount: row.open_residual_count,
      stallRisk: row.stall_risk,
      headRevision: row.revision ?? 0,
      updatedAt: row.updated_at
    }));

    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }

    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter((item) => {
        const haystack = `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    const [sortField = 'updatedAt', sortDirection = 'desc'] = (query.sort ?? 'updatedAt:desc').split(':');
    items.sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const leftValue = sortField === 'title' ? left.title ?? '' : left.updatedAt.getTime();
      const rightValue = sortField === 'title' ? right.title ?? '' : right.updatedAt.getTime();

      if (leftValue < rightValue) {
        return -1 * direction;
      }

      if (leftValue > rightValue) {
        return 1 * direction;
      }

      return 0;
    });

    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.max(query.pageSize ?? 50, 1);
    const offset = (page - 1) * pageSize;
    return items.slice(offset, offset + pageSize);
  }
}