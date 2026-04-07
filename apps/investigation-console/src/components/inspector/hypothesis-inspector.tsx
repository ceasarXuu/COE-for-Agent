import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function HypothesisInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.noPrimaryEvidence')}
      primaryTitle={t('inspector.primaryEvidence')}
      secondaryEmpty={t('inspector.noAdjacentNodes')}
      secondaryTitle={t('inspector.adjacentWork')}
    />
  );
}