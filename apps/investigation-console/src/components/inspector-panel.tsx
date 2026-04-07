import { DecisionInspector } from './inspector/decision-inspector.js';
import { ExperimentInspector } from './inspector/experiment-inspector.js';
import { FactInspector } from './inspector/fact-inspector.js';
import { GapInspector } from './inspector/gap-inspector.js';
import { HypothesisInspector } from './inspector/hypothesis-inspector.js';
import { ResidualInspector } from './inspector/residual-inspector.js';
import { useI18n } from '../lib/i18n.js';

export interface InspectorViewModel {
  kind: 'hypothesis' | 'inquiry' | 'fact' | 'experiment' | 'decision' | 'gap' | 'residual' | 'node';
  title: string;
  status: string | null;
  summary: string;
  primaryItems: string[];
  secondaryItems: string[];
  details?: {
    inquiryId?: string;
    supportingFactIds?: string[];
    linkedExperimentIds?: string[];
    relatedHypothesisIds?: string[];
    relatedSymptomIds?: string[];
  };
}

export function InspectorPanel(props: {
  inspector: InspectorViewModel | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  if (props.loading) {
    return (
      <section className="panel inspector-panel" data-testid="inspector-panel">
        <p className="panel-kicker">{t('inspector.kicker')}</p>
        <p>{t('inspector.loading')}</p>
      </section>
    );
  }

  if (!props.inspector) {
    return (
      <section className="panel inspector-panel" data-testid="inspector-panel">
        <p className="panel-kicker">{t('inspector.kicker')}</p>
        <p>{t('inspector.empty')}</p>
      </section>
    );
  }

  switch (props.inspector.kind) {
    case 'hypothesis':
      return <HypothesisInspector inspector={props.inspector} />;
    case 'fact':
      return <FactInspector inspector={props.inspector} />;
    case 'experiment':
      return <ExperimentInspector inspector={props.inspector} />;
    case 'decision':
      return <DecisionInspector inspector={props.inspector} />;
    case 'gap':
      return <GapInspector inspector={props.inspector} />;
    case 'residual':
      return <ResidualInspector inspector={props.inspector} />;
    case 'inquiry':
      return <GenericInspector inspector={props.inspector} primaryTitle={t('inspector.competingHypotheses')} secondaryTitle={t('inspector.openExperiments')} />;
    default:
      return <GenericInspector inspector={props.inspector} primaryTitle={t('inspector.primaryEvidence')} secondaryTitle={t('inspector.adjacentWork')} />;
  }
}

function GenericInspector(props: {
  inspector: InspectorViewModel;
  primaryTitle: string;
  secondaryTitle: string;
}) {
  const { formatEnumLabel, t } = useI18n();

  return (
    <section className="panel inspector-panel" data-testid="inspector-panel">
      <p className="panel-kicker">{t('inspector.panelKind', { kind: formatEnumLabel(props.inspector.kind) })}</p>
      <h4 data-testid="inspector-title">{props.inspector.title}</h4>
      <p className="inspector-status" data-testid="inspector-status">
        {formatEnumLabel(props.inspector.status ?? 'stateless')}
      </p>
      <p>{props.inspector.summary}</p>
      <div className="inspector-columns">
        <div>
          <p className="panel-kicker">{props.primaryTitle}</p>
          <ul className="compact-list">
            {props.inspector.primaryItems.length > 0
              ? props.inspector.primaryItems.map((item) => <li key={item}>{item}</li>)
              : <li>{t('inspector.noPrimaryEvidence')}</li>}
          </ul>
        </div>
        <div>
          <p className="panel-kicker">{props.secondaryTitle}</p>
          <ul className="compact-list">
            {props.inspector.secondaryItems.length > 0
              ? props.inspector.secondaryItems.map((item) => <li key={item}>{item}</li>)
              : <li>{t('inspector.noAdjacentNodes')}</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}