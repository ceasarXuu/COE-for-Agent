import type { CaseTimelineEnvelope } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function TimelineView(props: { timeline: CaseTimelineEnvelope }) {
  const { formatEventType, t } = useI18n();

  return (
    <section className="panel panel-diagnostic workspace-stage">
      <p className="panel-kicker">{t('timeline.kicker')}</p>
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
