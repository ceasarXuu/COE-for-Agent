import { readPersistenceStore, writePersistenceStore, type PersistenceExecutor } from '../client.js';

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
  constructor(private readonly db: PersistenceExecutor) {}

  async upsert(record: CaseListProjectionRecord): Promise<void> {
    await writePersistenceStore(this.db, (store) => {
      store.caseListProjection[record.caseId] = {
        caseId: record.caseId,
        title: record.title ?? null,
        summary: record.summary ?? null,
        severity: record.severity ?? null,
        status: record.status ?? null,
        stage: record.stage ?? null,
        activeHypothesisCount: record.activeHypothesisCount ?? 0,
        openGapCount: record.openGapCount ?? 0,
        openResidualCount: record.openResidualCount ?? 0,
        stallRisk: record.stallRisk ?? null,
        updatedAt: new Date()
      };
    });
  }

  async list(query: ListCaseProjectionQuery = {}): Promise<ListedCaseProjectionRecord[]> {
    return readPersistenceStore(this.db, (store) => {
      let items = Object.values(store.caseListProjection).map((row) => ({
        caseId: row.caseId,
        title: row.title,
        summary: row.summary,
        severity: row.severity,
        status: row.status,
        stage: row.stage,
        activeHypothesisCount: row.activeHypothesisCount,
        openGapCount: row.openGapCount,
        openResidualCount: row.openResidualCount,
        stallRisk: row.stallRisk,
        headRevision: store.cases[row.caseId]?.revision ?? 0,
        updatedAt: row.updatedAt
      }));

      if (query.status) {
        items = items.filter((item) => item.status === query.status);
      }

      if (query.search) {
        const term = query.search.toLowerCase();
        items = items.filter((item) => `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(term));
      }

      const [sortField = 'updatedAt', sortDirection = 'desc'] = (query.sort ?? 'updatedAt:desc').split(':');
      const direction = sortDirection === 'asc' ? 1 : -1;
      items.sort((left, right) => {
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
    });
  }
}
