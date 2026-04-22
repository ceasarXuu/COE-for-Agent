import { Link } from 'react-router-dom';

import { Badge } from '@coe/ui/components/badge';
import { Button } from '@coe/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@coe/ui/components/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@coe/ui/components/empty';
import { IconArrowRight, IconFolderPlus, IconSearch } from '@tabler/icons-react';

import type { CaseListItem } from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';

function severityVariant(severity: string | null | undefined): 'default' | 'secondary' | 'outline' {
  switch ((severity ?? '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function CaseGallery(props: {
  items: CaseListItem[];
  onCreateRequest: () => void;
  search?: string;
}) {
  const { formatDateTime, formatEnumLabel, t } = useI18n();

  if (props.items.length === 0) {
    return (
      <Empty className="border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconSearch />
          </EmptyMedia>
          <EmptyTitle>{t('cases.emptyTitle')}</EmptyTitle>
          <EmptyDescription>{t('cases.emptyCopy')}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={props.onCreateRequest} type="button">
          <IconFolderPlus data-icon="inline-start" />
          {t('caseCreate.submit')}
        </Button>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" data-testid="cases-gallery-v2">
      {props.items.map((item) => (
        <Link
          key={item.caseId}
          data-testid={`case-card-${item.caseId}`}
          to={{
            pathname: `/cases/${item.caseId}`,
            search: props.search ? `?${props.search}` : ''
          }}
        >
          <Card className="h-full transition-colors hover:bg-muted/30">
            <CardHeader>
              <CardAction>
                <Badge variant={severityVariant(item.severity)}>
                  {formatEnumLabel(item.severity ?? 'unknown')}
                </Badge>
              </CardAction>
              <CardTitle>{item.title ?? t('caseList.untitled')}</CardTitle>
              <CardDescription>{item.summary ?? t('caseList.defaultSummary')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{t('caseList.status')}</div>
                  <div className="mt-1 text-foreground">{formatEnumLabel(item.status ?? 'active')}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{t('caseList.stage')}</div>
                  <div className="mt-1 text-foreground">{formatEnumLabel(item.stage ?? 'intake')}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{t('caseList.revision')}</div>
                  <div className="mt-1 text-foreground">{item.headRevision}</div>
                </div>
              </div>
              <div>
                {item.updatedAt ? t('caseList.updated', { dateTime: formatDateTime(item.updatedAt) }) : t('caseList.noTimestamp')}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.caseId}</span>
              <IconArrowRight className="size-4 text-muted-foreground" />
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}
