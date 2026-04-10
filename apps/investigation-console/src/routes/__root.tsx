import { NavLink, Outlet } from 'react-router-dom';

import { useI18n } from '../lib/i18n.js';

export function RootLayout() {
  const { t } = useI18n();

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-brand">
          <span className="layout-kicker">{t('root.kicker')}</span>
          <h1 className="layout-title">{t('root.title')}</h1>
        </div>

        <nav className="layout-nav">
          <NavLink 
            className={({ isActive }) => `btn btn-ghost${isActive ? ' btn-primary' : ''}`}
            to="/cases"
          >
            {t('root.cases')}
          </NavLink>
        </nav>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
