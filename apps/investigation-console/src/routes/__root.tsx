import { Link, Outlet } from 'react-router-dom';

import { useI18n } from '../lib/i18n.js';

export function RootLayout() {
  const { t } = useI18n();

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-brand">
          <h1 className="layout-title">
            <Link className="layout-title-link" to="/cases">{t('root.title')}</Link>
          </h1>
        </div>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
