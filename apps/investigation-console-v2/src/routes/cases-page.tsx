import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Badge } from '@coe/ui/components/badge';
import { Button } from '@coe/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@coe/ui/components/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@coe/ui/components/input-group';
import {
  NativeSelect,
  NativeSelectOption
} from '@coe/ui/components/native-select';
import { IconLoader2, IconPlus, IconSearch } from '@tabler/icons-react';
import { buildIdempotencyKey } from '@coe/shared-utils';

import { CaseGallery } from '@/components/case-gallery.js';
import {
  CreateCaseDialog,
  type ManualCaseDraft
} from '@/components/create-case-dialog.js';
import { createCase, listCases, type CaseListItem } from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';

type CaseSortKey = 'priority' | 'recent' | 'title';

function sortCases(
  items: CaseListItem[],
  sort: CaseSortKey,
  compareText: (left: string, right: string) => number
): CaseListItem[] {
  const severityRank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return [...items].sort((left, right) => {
    if (sort === 'title') {
      return compareText(left.title ?? '', right.title ?? '');
    }

    if (sort === 'priority') {
      const severityDelta = (severityRank[right.severity?.toLowerCase() ?? ''] ?? 0) - (severityRank[left.severity?.toLowerCase() ?? ''] ?? 0);
      if (severityDelta !== 0) {
        return severityDelta;
      }
    }

    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return compareText(left.title ?? '', right.title ?? '');
  });
}

export function CasesPage() {
  const { compareText, t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const sort = (searchParams.get('sort') as CaseSortKey | null) ?? 'recent';
  const caseLinkSearch = searchParams.toString();
  const deferredQuery = useDeferredValue(query);

  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void listCases(deferredQuery ? { search: deferredQuery } : undefined)
      .then((result) => {
        if (cancelled) {
          return;
        }

        const sortedCases = sortCases(result.items, sort, compareText);
        console.info('[investigation-console-v2] cases-list-loaded', {
          event: 'cases.list.loaded',
          count: sortedCases.length,
          search: deferredQuery,
          sort
        });
        setCases(sortedCases);
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
  }, [compareText, deferredQuery, sort, t]);

  const loadedLabel = useMemo(() => t('cases.loaded', { count: cases.length }), [cases.length, t]);

  async function handleCreateCase(draft: ManualCaseDraft) {
    setCreatePending(true);
    setCreateError(null);

    try {
      const result = await createCase({
        idempotencyKey: buildIdempotencyKey('case-open-manual-v2'),
        title: draft.title,
        objective: draft.objective,
        severity: draft.severity,
        projectDirectory: draft.projectDirectory,
        labels: draft.labels
      });

      if (!result.caseId) {
        throw new Error(t('errors.createCaseMissingId'));
      }

      console.info('[investigation-console-v2] case-created', {
        event: 'case.create.completed',
        caseId: result.caseId,
        severity: draft.severity
      });

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
    <div className="flex flex-col gap-6">
      <CreateCaseDialog
        error={createError}
        open={createOpen}
        pending={createPending}
        onClose={() => {
          if (!createPending) {
            setCreateOpen(false);
            setCreateError(null);
          }
        }}
        onSubmit={handleCreateCase}
      />

      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{t('root.cases')}</CardTitle>
              <CardDescription>{loadedLabel}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{sort}</Badge>
              {loading ? (
                <Badge variant="secondary">
                  <IconLoader2 className="mr-1 size-3 animate-spin" />
                  {t('cases.refreshing')}
                </Badge>
              ) : (
                <Badge variant="outline">{t('cases.stableProjection')}</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>
                  <IconSearch />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                aria-label={t('cases.search')}
                autoComplete="off"
                name="q"
                placeholder={t('cases.searchPlaceholder')}
                spellCheck={false}
                type="search"
                value={query}
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
              />
            </InputGroup>

            <NativeSelect
              aria-label={t('cases.sort')}
              value={sort}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  if (value === 'recent') {
                    next.delete('sort');
                  } else {
                    next.set('sort', value);
                  }
                  return next;
                }, { replace: true });
              }}
            >
              <NativeSelectOption value="recent">{t('cases.sortRecent')}</NativeSelectOption>
              <NativeSelectOption value="priority">{t('cases.sortPriority')}</NativeSelectOption>
              <NativeSelectOption value="title">{t('cases.sortTitle')}</NativeSelectOption>
            </NativeSelect>

            <Button
              className="justify-center lg:justify-start"
              data-testid="cases-toolbar-create"
              onClick={() => {
                console.info('[investigation-console-v2] case-create-dialog-opened', {
                  event: 'case.create_dialog.opened',
                  source: 'cases-toolbar'
                });
                setCreateError(null);
                setCreateOpen(true);
              }}
              type="button"
            >
              <IconPlus data-icon="inline-start" />
              {t('caseCreate.submit')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {error ? (
            <Card className="border-destructive/20 bg-destructive/5 ring-destructive/10">
              <CardContent className="py-4 text-destructive">{error}</CardContent>
            </Card>
          ) : null}

          <CaseGallery
            items={cases}
            onCreateRequest={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            search={caseLinkSearch}
          />
        </CardContent>
      </Card>
    </div>
  );
}
