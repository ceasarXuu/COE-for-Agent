import type { CaseSnapshotEnvelope } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function SnapshotView(props: { snapshot: CaseSnapshotEnvelope; historical: boolean }) {
  const { formatEnumLabel, t } = useI18n();
  const caseRecord = props.snapshot.data.case;

  return (
    <section className="panel panel-context panel-hero" data-testid="snapshot-panel">
      <p className="panel-kicker">{t('snapshot.kicker')}</p>
      <div className="panel-headline-row">
        <h3 data-testid="snapshot-stage">{formatEnumLabel(caseRecord?.stage ?? 'unknown')}</h3>
        <span className={`pill pill-${(caseRecord?.severity ?? 'medium').toLowerCase()}`}>{formatEnumLabel(caseRecord?.severity ?? 'unknown')}</span>
      </div>
      <p className="snapshot-objective">{caseRecord?.objective ?? t('snapshot.defaultObjective')}</p>
      {props.historical ? (
        <p className="history-banner" data-testid="historical-mode">
          {t('snapshot.historical')}
        </p>
      ) : null}
      <div className="metric-strip">
        <span>{t('snapshot.inquiries', { count: props.snapshot.data.counts.inquiries })}</span>
        <span>{t('snapshot.symptoms', { count: props.snapshot.data.counts.symptoms })}</span>
        <span>{t('snapshot.artifacts', { count: props.snapshot.data.counts.artifacts })}</span>
        <span>{t('snapshot.facts', { count: props.snapshot.data.counts.facts })}</span>
      </div>
    </section>
  );
}
