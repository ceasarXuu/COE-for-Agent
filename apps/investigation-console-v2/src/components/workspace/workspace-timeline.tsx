import { useMemo } from 'react';

import { Badge } from '@coe/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@coe/ui/components/card';
import { ScrollArea } from '@coe/ui/components/scroll-area';
import { Separator } from '@coe/ui/components/separator';
import { Slider } from '@coe/ui/components/slider';

import type { CaseTimelineEnvelope } from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';

export function WorkspaceTimeline(props: {
  currentRevision: number;
  maxRevision: number;
  onChange: (revision: number) => void;
  timeline: CaseTimelineEnvelope;
}) {
  const { formatEventType, t } = useI18n();

  const groupedRevisions = useMemo(
    () =>
      [...new Set(props.timeline.data.events.map((event) => event.caseRevision))]
        .sort((left, right) => left - right)
        .map((revision) => ({
          revision,
          events: props.timeline.data.events.filter((event) => event.caseRevision === revision)
        })),
    [props.timeline.data.events]
  );

  const currentRevisionEvents = groupedRevisions.find((entry) => entry.revision === props.currentRevision)?.events ?? [];

  return (
    <Card>
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t('timeline.kicker')}</CardTitle>
            <CardDescription>{t('timeline.rev', { revision: props.currentRevision })}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{props.currentRevision}/{props.maxRevision}</Badge>
            <Badge variant="secondary">{currentRevisionEvents.length} events</Badge>
          </div>
        </div>
        {props.maxRevision >= 2 ? (
          <div className="space-y-3">
            <Slider
              aria-label="Revision slider"
              max={props.maxRevision}
              min={1}
              step={1}
              value={[props.currentRevision]}
              onValueChange={(values) => {
                const nextValue = values[0];
                if (typeof nextValue === 'number' && nextValue !== props.currentRevision) {
                  props.onChange(nextValue);
                }
              }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>{props.maxRevision}</span>
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-40">
          <div className="flex flex-col gap-3">
            {currentRevisionEvents.map((event, index) => (
              <div className="space-y-2" key={event.eventId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{formatEventType(event.eventType)}</div>
                    <div className="text-sm text-muted-foreground">{event.summary}</div>
                  </div>
                  <Badge variant="outline">
                    {t(event.editorOrigin === 'web_ui' ? 'revision.origin.web_ui' : 'revision.origin.agent')}
                  </Badge>
                </div>
                {index < currentRevisionEvents.length - 1 ? <Separator /> : null}
              </div>
            ))}
            {currentRevisionEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('graph.empty')}</div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
