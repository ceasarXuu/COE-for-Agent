import type { GuardrailBundle } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

export function GuardrailView(props: { guardrails: GuardrailBundle }) {
  const { formatEnumLabel, t } = useI18n();
  const warningCount = Array.isArray(props.guardrails.aggregate.warnings) ? props.guardrails.aggregate.warnings.length : 0;
  const violationCount = Array.isArray(props.guardrails.aggregate.violations) ? props.guardrails.aggregate.violations.length : 0;

  return (
    <section className="panel">
      <div className="panel-headline-row">
        <p className="panel-kicker">{t('guardrails.kicker')}</p>
        <span className="focus-chip">{t('guardrails.counts', { warnings: warningCount, violations: violationCount })}</span>
      </div>
      <ul className="compact-list">
        <li>
          <strong>{t('guardrails.stall')}</strong>
          <span>{props.guardrails.stall.stall ? props.guardrails.stall.reason ?? formatEnumLabel('stalled') : formatEnumLabel('clear')}</span>
        </li>
        <li>
          <strong>{t('guardrails.ready')}</strong>
          <span>{formatEnumLabel(props.guardrails.readyToPatch.pass ? 'pass' : 'blocked')}</span>
        </li>
        <li>
          <strong>{t('guardrails.close')}</strong>
          <span>{formatEnumLabel(props.guardrails.closeCase.pass ? 'pass' : 'blocked')}</span>
        </li>
      </ul>
    </section>
  );
}