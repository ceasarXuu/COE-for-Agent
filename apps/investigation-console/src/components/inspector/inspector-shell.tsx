import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';

export function InspectorShell(props: {
  inspector: InspectorViewModel;
  primaryTitle: string;
  secondaryTitle: string;
  primaryEmpty: string;
  secondaryEmpty: string;
}) {
  const { formatEnumLabel, t } = useI18n();

  return (
    <section className="panel panel-context inspector-panel" data-testid="inspector-panel">
      <p className="panel-kicker">{t('inspector.panelKind', { kind: formatEnumLabel(props.inspector.kind) })}</p>
      <h4 data-testid="inspector-title">{props.inspector.title}</h4>
      <p className="inspector-status" data-testid="inspector-status">
        {formatEnumLabel(props.inspector.status ?? 'stateless')}
      </p>
      {props.inspector.summary ? <p>{props.inspector.summary}</p> : null}
      <div className="inspector-columns">
        <div>
          <p className="panel-kicker">{props.primaryTitle}</p>
          <ul className="compact-list">
            {props.inspector.primaryItems.length > 0
              ? props.inspector.primaryItems.map((item) => <li key={item}>{item}</li>)
              : <li>{props.primaryEmpty}</li>}
          </ul>
        </div>
        <div>
          <p className="panel-kicker">{props.secondaryTitle}</p>
          <ul className="compact-list">
            {props.inspector.secondaryItems.length > 0
              ? props.inspector.secondaryItems.map((item) => <li key={item}>{item}</li>)
              : <li>{props.secondaryEmpty}</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
