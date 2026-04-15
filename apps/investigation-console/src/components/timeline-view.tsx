import type { CaseTimelineEnvelope } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { RevisionSlider } from './revision-slider.js';

export function TimelineView(props: {
  timeline: CaseTimelineEnvelope;
  revisionControls?: {
    currentRevision: number;
    maxRevision: number;
    onChange: (revision: number) => void;
  };
}) {
  const { formatEventType, t } = useI18n();
  const shouldShowRevisionControls = (props.revisionControls?.maxRevision ?? 0) >= 2;

  return (
    <section className="panel panel-diagnostic workspace-stage timeline-stage workspace-stage-fill">
      <p className="panel-kicker">{t('timeline.kicker')}</p>
      {shouldShowRevisionControls && props.revisionControls ? (
        <RevisionSlider
          currentRevision={props.revisionControls.currentRevision}
          maxRevision={props.revisionControls.maxRevision}
          onChange={props.revisionControls.onChange}
        />
      ) : null}
      <ul className="timeline-list">
        {props.timeline.data.events.map((event) => (
          <li data-testid={`timeline-event-${event.eventId}`} key={event.eventId}>
            <div>
              <strong>{formatEventType(event.eventType)}</strong>
              <span>{t('timeline.rev', { revision: event.caseRevision })}</span>
            </div>
            <p>{event.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
