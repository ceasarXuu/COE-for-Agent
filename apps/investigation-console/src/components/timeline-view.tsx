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
  const revisions = [...new Set(props.timeline.data.events.map((event) => event.caseRevision))]
    .sort((left, right) => left - right)
    .map((revision) => ({
      revision,
      events: props.timeline.data.events
        .filter((event) => event.caseRevision === revision)
        .map((event) => ({
          eventId: event.eventId,
          originLabel: t(event.editorOrigin === 'web_ui' ? 'revision.origin.web_ui' : 'revision.origin.agent'),
          revision: event.caseRevision,
          summary: event.summary,
          title: formatEventType(event.eventType)
        }))
    }));

  return (
    <section className="timeline-strip" data-testid="timeline-strip">
      <span className="timeline-strip-label">{t('timeline.kicker')}</span>
      {shouldShowRevisionControls && props.revisionControls ? (
        <RevisionSlider
          currentRevision={props.revisionControls.currentRevision}
          maxRevision={props.revisionControls.maxRevision}
          onChange={props.revisionControls.onChange}
          revisions={revisions}
        />
      ) : null}
    </section>
  );
}
