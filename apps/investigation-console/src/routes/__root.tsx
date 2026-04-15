import { Link, Outlet } from 'react-router-dom';

import { useI18n, type Locale } from '../lib/i18n.js';

const GITHUB_REPO_URL = 'https://github.com/ceasarXuu/COE-for-Agent';

export function RootLayout() {
  const { locale, setLocale, t } = useI18n();

  function handleGithubClick() {
    console.info('[investigation-console] open-repo-homepage', {
      href: GITHUB_REPO_URL,
      source: 'layout-header'
    });
  }

  function handleLocaleChange(nextLocale: Locale) {
    if (nextLocale === locale) {
      return;
    }

    console.info('[investigation-console] locale-changed', {
      previousLocale: locale,
      nextLocale,
      source: 'layout-header'
    });
    setLocale(nextLocale);
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-brand">
          <div className="layout-title-row">
            <h1 className="layout-title">
              <Link className="layout-title-link" to="/cases">{t('root.title')}</Link>
            </h1>
          </div>
        </div>

        <div className="layout-actions">
          <a
            aria-label={t('root.githubLinkLabel')}
            className="layout-github-link"
            data-testid="layout-github-link"
            href={GITHUB_REPO_URL}
            onClick={handleGithubClick}
            rel="noreferrer noopener"
            target="_blank"
            title={t('root.githubLinkLabel')}
          >
            <svg
              aria-hidden="true"
              className="layout-github-icon"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.38 6.84 9.73.5.09.66-.22.66-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.46-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.15-4.56-5.14 0-1.14.39-2.08 1.03-2.81-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.07A9.3 9.3 0 0 1 12 7.1c.85 0 1.71.12 2.51.36 1.91-1.35 2.75-1.07 2.75-1.07.55 1.42.2 2.47.1 2.73.64.73 1.03 1.67 1.03 2.81 0 4-2.34 4.87-4.57 5.13.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.59.67.49A10.25 10.25 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z"
                fill="currentColor"
              />
            </svg>
          </a>
          <div
            aria-label={t('root.languageSwitcher')}
            className="layout-locale-switcher"
            role="group"
          >
            <button
              aria-label={t('root.switchToEnglish')}
              aria-pressed={locale === 'en'}
              className={`layout-locale-button${locale === 'en' ? ' active' : ''}`}
              data-testid="layout-locale-en"
              onClick={() => handleLocaleChange('en')}
              title={t('root.switchToEnglish')}
              type="button"
            >
              EN
            </button>
            <button
              aria-label={t('root.switchToChinese')}
              aria-pressed={locale === 'zh-CN'}
              className={`layout-locale-button${locale === 'zh-CN' ? ' active' : ''}`}
              data-testid="layout-locale-zh-CN"
              onClick={() => handleLocaleChange('zh-CN')}
              title={t('root.switchToChinese')}
              type="button"
            >
              中文
            </button>
          </div>
        </div>
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
