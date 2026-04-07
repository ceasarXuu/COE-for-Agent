import { NavLink, Outlet } from 'react-router-dom';

import { useI18n } from '../lib/i18n.js';

export function RootLayout() {
  const { t } = useI18n();

  return (
    <div className="console-shell">
      <header className="console-chrome">
        <div className="chrome-brand">
          <p className="chrome-kicker">{t('root.kicker')}</p>
          <h1>{t('root.title')}</h1>
        </div>
        <div className="chrome-statusband">
          <span>{t('root.audit')}</span>
          <span>{t('root.patch')}</span>
          <span>{t('root.graph')}</span>
        </div>
        <nav className="chrome-nav">
          <NavLink className="chrome-link" to="/cases">
            {t('root.cases')}
          </NavLink>
        </nav>
      </header>
      <main className="console-main">
        <Outlet />
      </main>
    </div>
  );
}