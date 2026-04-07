import { createResourceEnvelope } from '@coe/domain';
import { CaseListProjectionRepository, type ListCaseProjectionQuery } from '@coe/persistence';
import { sql } from 'kysely';

import type { InvestigationServerServices } from '../../services.js';

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function readCasesResource(services: InvestigationServerServices, url: URL) {
  const repository = new CaseListProjectionRepository(services.db);
  const query: ListCaseProjectionQuery = {
    page: parsePositiveInteger(url.searchParams.get('page'), 1),
    pageSize: parsePositiveInteger(url.searchParams.get('pageSize'), 50)
  };
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort');

  if (status !== null) {
    query.status = status;
  }

  if (search !== null) {
    query.search = search;
  }

  if (sort !== null) {
    query.sort = sort;
  }

  const items = await repository.list(query);
  const revisionRow = await sql<{ head_revision: number }>`select coalesce(max(revision), 0) as head_revision from cases`.execute(
    services.db
  );
  const headRevision = Number(revisionRow.rows[0]?.head_revision ?? 0);

  return {
    uri: url.toString(),
    mimeType: 'application/json' as const,
    data: createResourceEnvelope({
      headRevision,
      projectionRevision: headRevision,
      requestedRevision: null,
      data: {
        items: items.map((item) => ({
          caseId: item.caseId,
          title: item.title,
          status: item.status,
          stage: item.stage,
          severity: item.severity,
          headRevision: item.headRevision,
          updatedAt: item.updatedAt.toISOString()
        }))
      }
    })
  };
}