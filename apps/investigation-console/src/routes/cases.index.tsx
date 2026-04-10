import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CaseList } from '../components/case-list.js';
import { CreateCasePanel, type ManualCaseDraft } from '../components/create-case-panel.js';
import { createCase, listCases, type CaseListItem } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { buildIdempotencyKey } from '@coe/shared-utils';

export function CasesIndexRoute() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
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
          setCases(result.items);
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
  }, [deferredQuery]);

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
          <div className="case-index-copy">
            <p className="panel-kicker">{t('cases.galleryKicker')}</p>
            <h2>{t('cases.galleryTitle')}</h2>
            <p>{t('cases.galleryCopy')}</p>
          </div>

          <div className="case-index-toolbar-controls">
            <label className="search-field">
              <span>{t('cases.search')}</span>
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
            <div aria-live="polite" className="toolbar-badges">
              <span>{t('cases.loaded', { count: cases.length })}</span>
              <span>{loading ? t('cases.refreshing') : t('cases.stableProjection')}</span>
            </div>
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

          {!loading && cases.length === 0 ? (
            <article className="empty-card" data-testid="cases-empty-state">
              <p className="panel-kicker">{t('cases.emptyKicker')}</p>
              <h3>{t('cases.emptyTitle')}</h3>
              <p>{t('cases.emptyCopy')}</p>
            </article>
          ) : null}
        </div>
      </div>
    </div>
  );
}
