import { useDeferredValue, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { CaseList } from '../components/case-list.js';
import { listCases, type CaseListItem } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function CasesIndexRoute() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const caseLinkSearch = searchParams.toString();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="case-index">
      <div className="case-index-board">
        <div className="case-index-toolbar">
          <label className="search-field">
            <span>{t('cases.search')}</span>
            <input
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

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="case-grid-shell">
          <CaseList items={cases} search={caseLinkSearch} />

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
