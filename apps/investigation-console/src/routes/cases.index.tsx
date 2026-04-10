import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CaseList } from '../components/case-list.js';
import { CreateCasePanel, type ManualCaseDraft } from '../components/create-case-panel.js';
import { createCase, listCases, type CaseListItem } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { buildIdempotencyKey } from '@coe/shared-utils';

type CaseSortKey = 'priority' | 'recent' | 'title';

function sortCases(
  items: CaseListItem[],
  sort: CaseSortKey,
  compareText: (left: string, right: string) => number
): CaseListItem[] {
  const severityRank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return [...items].sort((left, right) => {
    if (sort === 'title') {
      return compareText(left.title ?? '', right.title ?? '');
    }

    if (sort === 'priority') {
      const severityDelta = (severityRank[right.severity?.toLowerCase() ?? ''] ?? 0) - (severityRank[left.severity?.toLowerCase() ?? ''] ?? 0);
      if (severityDelta !== 0) {
        return severityDelta;
      }
    }

    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return compareText(left.title ?? '', right.title ?? '');
  });
}

export function CasesIndexRoute() {
  const { compareText, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const sort = (searchParams.get('sort') as CaseSortKey | null) ?? 'recent';
  const caseLinkSearch = searchParams.toString();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listCases(deferredQuery ? { search: deferredQuery } : undefined)
      .then((result) => {
        if (!cancelled) {
          setCases(sortCases(result.items, sort, compareText));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t('errors.loadCases'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compareText, deferredQuery, sort, t]);

  async function handleCreateCase(draft: ManualCaseDraft) {
    setCreatePending(true);
    setCreateError(null);

    try {
      const result = await createCase({
        idempotencyKey: buildIdempotencyKey('case-open-manual'),
        title: draft.title.trim(),
        objective: draft.objective.trim(),
        severity: draft.severity,
        environment: draft.environment,
        labels: draft.labels
      });

      if (!result.caseId) {
        throw new Error(t('errors.createCaseMissingId'));
      }

      setCreateOpen(false);
      startTransition(() => {
        navigate({
          pathname: `/cases/${result.caseId}`,
          search: caseLinkSearch ? `?${caseLinkSearch}` : ''
        });
      });
    } catch (reason: unknown) {
      setCreateError(reason instanceof Error ? reason.message : t('errors.createCase'));
    } finally {
      setCreatePending(false);
    }
  }

  return (
    <div className="case-index">
      <CreateCasePanel
        error={createError}
        onClose={() => {
          if (!createPending) {
            setCreateOpen(false);
            setCreateError(null);
          }
        }}
        onSubmit={handleCreateCase}
        open={createOpen}
        pending={createPending}
      />

      <div className="case-index-board">
        <div className="case-index-toolbar">
          <div className="case-index-toolbar-controls">
            <label className="search-field">
              <input
                aria-label={t('cases.search')}
                autoComplete="off"
                name="q"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    if (value) {
                      next.set('q', value);
                    } else {
                      next.delete('q');
                    }
                    return next;
                  }, { replace: true });
                }}
                placeholder={t('cases.searchPlaceholder')}
                spellCheck={false}
                type="search"
                value={query}
              />
            </label>
            <label className="sort-field">
              <select
                aria-label={t('cases.sort')}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current);
                    if (value === 'recent') {
                      next.delete('sort');
                    } else {
                      next.set('sort', value);
                    }
                    return next;
                  }, { replace: true });
                }}
                value={sort}
              >
                <option value="recent">{t('cases.sortRecent')}</option>
                <option value="priority">{t('cases.sortPriority')}</option>
                <option value="title">{t('cases.sortTitle')}</option>
              </select>
            </label>
          </div>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="case-grid-shell">
          <CaseList
            items={cases}
            onCreateRequest={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            search={caseLinkSearch}
          />
        </div>
      </div>
    </div>
  );
}
