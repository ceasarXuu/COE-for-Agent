import { Outlet } from 'react-router-dom';

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
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
