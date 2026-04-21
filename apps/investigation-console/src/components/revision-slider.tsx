import { type CSSProperties, useEffect, useMemo, useState } from 'react';

export function RevisionSlider(props: {
  maxRevision: number;
  currentRevision: number;
  onChange: (revision: number) => void;
  revisions?: Array<{
    revision: number;
    events: Array<{
      eventId: string;
      originLabel: string;
      revision: number;
      summary: string;
      title: string;
    }>;
  }>;
}) {
  const [draftRevision, setDraftRevision] = useState(props.currentRevision);

  useEffect(() => {
    setDraftRevision(props.currentRevision);
  }, [props.currentRevision]);

  const markers = useMemo(
    () => Array.from({ length: props.maxRevision }, (_, index) => index + 1),
    [props.maxRevision]
  );
  const revisionLookup = useMemo(
    () => new Map((props.revisions ?? []).map((item) => [item.revision, item.events])),
    [props.revisions]
  );

  const handleRevisionChange = (revisionValue: string) => {
    const revision = Number(revisionValue);
    setDraftRevision(revision);
    props.onChange(revision);
  };

  return (
    <div
      className="revision-slider-shell"
      style={{ '--revision-progress': `${getRevisionMarkerPercent(draftRevision, props.maxRevision)}%` } as CSSProperties}
    >
      <input
        aria-label="Revision slider"
        data-testid="revision-slider"
        max={props.maxRevision}
        min={1}
        onChange={(event) => handleRevisionChange(event.currentTarget.value)}
        step={1}
        type="range"
        value={draftRevision}
      />
      <div aria-hidden="true" className="revision-marker-row">
        {markers.map((marker) => (
          <button
            aria-label={`Revision ${marker}`}
            className="revision-marker-slot"
            data-testid={`revision-marker-slot-${marker}`}
            key={marker}
            onClick={() => handleRevisionChange(String(marker))}
            style={{ left: `${getRevisionMarkerPercent(marker, props.maxRevision)}%` }}
            type="button"
          >
            <span className="revision-marker" data-testid={`revision-marker-${marker}`} />
            {revisionLookup.has(marker) ? (
              <div className="revision-hover-bubble" data-testid={`revision-bubble-${marker}`}>
                {revisionLookup.get(marker)?.map((event) => (
                  <div className="revision-hover-bubble-entry" key={event.eventId}>
                    <span className="revision-hover-origin">{event.originLabel}</span>
                    <strong>{event.title}</strong>
                    <p>{event.summary}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </button>
        ))}
      </div>
      <span className="visually-hidden" data-testid="revision-value">
        {draftRevision}
      </span>
    </div>
  );
}

export function getRevisionMarkerPercent(revision: number, maxRevision: number) {
  return maxRevision <= 1 ? 0 : ((revision - 1) / (maxRevision - 1)) * 100;
}
