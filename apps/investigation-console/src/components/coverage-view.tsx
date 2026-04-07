import type { CaseCoverageEnvelope } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function CoverageView(props: { coverage: CaseCoverageEnvelope }) {
  const { formatEnumLabel, t } = useI18n();

  return (
    <section className="panel">
      <div className="panel-headline-row">
        <p className="panel-kicker">{t('coverage.kicker')}</p>
        <span className="focus-chip">
          {t('coverage.summary', {
            direct: props.coverage.data.summary.direct,
            uncovered: props.coverage.data.summary.none
          })}
        </span>
      </div>
      <ul className="compact-list">
        {props.coverage.data.items.map((item) => (
          <li key={item.symptomId}>
            <strong>{formatEnumLabel(item.coverage)}</strong>
            <span>{item.statement}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}