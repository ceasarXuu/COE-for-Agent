import { useDeferredValue, useEffect, useState } from 'react';

import { CaseList } from '../components/case-list.js';
import { listCases, type CaseListItem } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function CasesIndexRoute() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
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
    <section className="case-index">
      <aside className="hero-panel">
        <p className="panel-kicker">{t('cases.hero.kicker')}</p>
        <h2>{t('cases.hero.title')}</h2>
        <p className="panel-copy">{t('cases.hero.copy')}</p>
      </aside>

      <section className="case-index-board">
        <div className="case-index-toolbar">
          <label className="search-field">
            <span>{t('cases.search')}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t('cases.searchPlaceholder')}
            />
          </label>
          <div className="toolbar-badges">
            <span>{t('cases.loaded', { count: cases.length })}</span>
            <span>{loading ? t('cases.refreshing') : t('cases.stableProjection')}</span>
          </div>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="case-grid-shell">
          <CaseList items={cases} />

          {!loading && cases.length === 0 ? (
            <article className="empty-card">
              <p className="panel-kicker">{t('cases.emptyKicker')}</p>
              <h3>{t('cases.emptyTitle')}</h3>
              <p>{t('cases.emptyCopy')}</p>
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}