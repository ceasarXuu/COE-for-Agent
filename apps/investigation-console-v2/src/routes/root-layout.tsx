import { Link, Outlet } from 'react-router-dom';

import { Button } from '@coe/ui/components/button';
import { Toaster } from '@coe/ui/components/sonner';
import { TooltipProvider } from '@coe/ui/components/tooltip';
import { IconBrandGithub } from '@tabler/icons-react';

import { useI18n, type Locale } from '@/lib/i18n.js';

const GITHUB_REPO_URL = 'https://github.com/ceasarXuu/COE-for-Agent';

export function RootLayout() {
  const { locale, setLocale, t } = useI18n();

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/94 backdrop-blur">
          <div className="flex h-14 w-full items-center justify-between gap-4 px-4 md:h-16 md:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
                <Link className="transition-colors hover:text-primary" to="/cases">
                  {t('root.title')}
                </Link>
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <LocaleSwitch locale={locale} onChange={setLocale} />
              <Button asChild size="icon-sm" type="button" variant="outline">
                <a
                  aria-label={t('root.githubLinkLabel')}
                  data-testid="layout-github-link"
                  href={GITHUB_REPO_URL}
                  rel="noreferrer noopener"
                  target="_blank"
                  title={t('root.githubLinkLabel')}
                >
                  <IconBrandGithub />
                </a>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex min-h-[calc(100svh-3.5rem)] w-full flex-1 flex-col px-4 py-4 md:min-h-[calc(100svh-4rem)] md:px-6 md:py-6">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

function LocaleSwitch(props: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  const { t } = useI18n();

  function renderButton(targetLocale: Locale, label: string) {
    const active = props.locale === targetLocale;

    return (
      <button
        aria-label={targetLocale === 'en' ? t('root.switchToEnglish') : t('root.switchToChinese')}
        aria-pressed={active}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        onClick={() => props.onChange(targetLocale)}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <div
      aria-label={t('root.languageSwitcher')}
      className="flex items-center rounded-lg border border-border/70 bg-card/60 p-1"
      role="group"
    >
      {renderButton('en', 'EN')}
      {renderButton('zh-CN', '中文')}
    </div>
  );
}
