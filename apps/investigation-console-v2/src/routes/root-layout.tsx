import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { Button } from '@coe/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@coe/ui/components/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@coe/ui/components/sheet';
import { Separator } from '@coe/ui/components/separator';
import { Toaster } from '@coe/ui/components/sonner';
import { TooltipProvider } from '@coe/ui/components/tooltip';
import {
  IconBrandGithub,
  IconFolderSearch,
  IconLanguage,
  IconMenu2
} from '@tabler/icons-react';

import { useI18n, type Locale } from '@/lib/i18n.js';

const GITHUB_REPO_URL = 'https://github.com/ceasarXuu/COE-for-Agent';

export function RootLayout() {
  const location = useLocation();
  const { locale, setLocale, t } = useI18n();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        <div className="flex min-h-svh">
          <aside className="hidden w-80 shrink-0 border-r bg-muted/20 xl:block">
            <div className="sticky top-0 p-4">
              <Card className="h-[calc(100svh-2rem)]">
                <CardHeader className="border-b">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <IconFolderSearch className="size-4" />
                    </div>
                    <div>
                      <CardTitle>{t('root.title')}</CardTitle>
                      <div className="text-xs text-muted-foreground">v2 / shadcn</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-6 pt-6">
                  <NavigationContent
                    locale={locale}
                    pathname={location.pathname}
                    setLocale={setLocale}
                  />
                </CardContent>
              </Card>
            </div>
          </aside>

          <div className="flex min-h-svh flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/92 px-4 backdrop-blur md:px-6">
              <Button
                className="xl:hidden"
                onClick={() => setNavOpen(true)}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <IconMenu2 />
                <span className="sr-only">Open navigation</span>
              </Button>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">COE</span>
                <span className="truncate text-sm font-medium text-foreground">{t('root.title')}</span>
              </div>
            </header>

            <main className="min-h-[calc(100svh-4rem)] p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent className="w-[320px] px-0" side="left">
            <SheetHeader className="px-6 pb-4">
              <SheetTitle>{t('root.title')}</SheetTitle>
            </SheetHeader>
            <div className="px-6 pb-6">
              <NavigationContent
                locale={locale}
                pathname={location.pathname}
                setLocale={(nextLocale) => {
                  setLocale(nextLocale);
                  setNavOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

function NavigationContent(props: {
  locale: Locale;
  pathname: string;
  setLocale: (locale: Locale) => void;
}) {
  const { t } = useI18n();

  function localeButton(targetLocale: Locale, label: string) {
    const active = props.locale === targetLocale;

    return (
      <button
        className={`rounded-md px-2 py-1 text-xs transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        onClick={() => props.setLocale(targetLocale)}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('root.cases')}</div>
        <Link
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${props.pathname.startsWith('/cases') ? 'bg-primary text-primary-foreground' : 'hover:bg-muted hover:text-foreground'}`}
          to="/cases"
        >
          <IconFolderSearch className="size-4" />
          <span>{t('root.cases')}</span>
        </Link>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <IconLanguage className="size-3.5" />
          {t('root.languageSwitcher')}
        </div>
        <div className="flex items-center gap-2">
          {localeButton('en', 'EN')}
          {localeButton('zh-CN', '中文')}
        </div>
      </div>

      <div className="mt-auto">
        <a
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          data-testid="layout-github-link"
          href={GITHUB_REPO_URL}
          rel="noreferrer noopener"
          target="_blank"
        >
          <IconBrandGithub className="size-4" />
          <span>GitHub</span>
        </a>
      </div>
    </div>
  );
}
