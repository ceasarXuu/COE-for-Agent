import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@coe/ui/components/badge';

import type { CaseTimelineEnvelope } from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';

export function WorkspaceTimeline(props: {
  currentRevision: number;
  maxRevision: number;
  onChange: (revision: number) => void;
  timeline: CaseTimelineEnvelope;
}) {
  const { formatEventType, t } = useI18n();
  const [draftRevision, setDraftRevision] = useState(props.currentRevision);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftRevision(props.currentRevision);
  }, [props.currentRevision]);

  const markers = useMemo(
    () => Array.from({ length: props.maxRevision }, (_, index) => index + 1),
    [props.maxRevision]
  );

  const revisionLookup = useMemo(
    () =>
      new Map(
        [...new Set(props.timeline.data.events.map((event) => event.caseRevision))]
          .sort((left, right) => left - right)
          .map((revision) => [
            revision,
            props.timeline.data.events
              .filter((event) => event.caseRevision === revision)
              .map((event) => ({
                eventId: event.eventId,
                originLabel: t(event.editorOrigin === 'web_ui' ? 'revision.origin.web_ui' : 'revision.origin.agent'),
                revision: event.caseRevision,
                summary: event.summary,
                title: formatEventType(event.eventType)
              }))
          ])
      ),
    [formatEventType, props.timeline.data.events, t]
  );

  const handleRevisionChange = (revisionValue: string) => {
    const revision = Number(revisionValue);
    setDraftRevision(revision);
    props.onChange(revision);
  };

  const handlePointerRevisionChange = (clientX: number) => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const rect = shell.getBoundingClientRect();
    handleRevisionChange(String(getRevisionFromPointer(clientX, rect.left, rect.width, props.maxRevision)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    handlePointerRevisionChange(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    event.preventDefault();
    handlePointerRevisionChange(event.clientX);
  };

  const handlePointerRelease = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (props.maxRevision < 2) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card/70 px-4 py-3 md:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{t('timeline.kicker')}</div>
        <Badge variant="outline">{t('timeline.rev', { revision: draftRevision })}</Badge>
      </div>
      <div
        className="relative"
        onPointerCancel={handlePointerRelease}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerRelease}
        ref={shellRef}
        style={{ '--revision-progress': `${getRevisionMarkerPercent(draftRevision, props.maxRevision)}%` } as CSSProperties}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-border/60" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary"
          style={{ width: 'var(--revision-progress)' }}
        />
        <input
          aria-label="Revision slider"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          data-testid="revision-slider"
          max={props.maxRevision}
          min={1}
          onChange={(event) => handleRevisionChange(event.currentTarget.value)}
          step={1}
          type="range"
          value={draftRevision}
        />
        <div aria-hidden="true" className="relative h-8">
          {markers.map((marker) => (
            <button
              aria-label={`Revision ${marker}`}
              className="group absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2"
              data-testid={`revision-marker-slot-${marker}`}
              key={marker}
              style={{ left: `${getRevisionMarkerPercent(marker, props.maxRevision)}%` }}
              type="button"
            >
              <span
                className={`absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${marker <= draftRevision ? 'border-primary bg-primary' : 'border-border bg-background'}`}
                data-testid={`revision-marker-${marker}`}
              />
              {revisionLookup.has(marker) ? (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left text-sm text-popover-foreground shadow-xl group-hover:block"
                  data-testid={`revision-bubble-${marker}`}
                >
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {t('timeline.rev', { revision: marker })}
                  </div>
                  <div className="space-y-2">
                    {revisionLookup.get(marker)?.map((event) => (
                      <div className="space-y-1" key={event.eventId}>
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm leading-none">{event.title}</strong>
                          <span className="text-xs text-muted-foreground">{event.originLabel}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{event.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>1</span>
        <span>{props.maxRevision}</span>
      </div>
    </section>
  );
}

export function getRevisionMarkerPercent(revision: number, maxRevision: number) {
  return maxRevision <= 1 ? 0 : ((revision - 1) / (maxRevision - 1)) * 100;
}

export function getRevisionFromPointer(clientX: number, railLeft: number, railWidth: number, maxRevision: number) {
  if (maxRevision <= 1 || railWidth <= 0) {
    return 1;
  }

  const progress = Math.min(Math.max((clientX - railLeft) / railWidth, 0), 1);
  return Math.round(progress * (maxRevision - 1)) + 1;
}
