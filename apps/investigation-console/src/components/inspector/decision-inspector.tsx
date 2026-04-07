import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function DecisionInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.decision.primaryEmpty')}
      primaryTitle={t('inspector.decision.primary')}
      secondaryEmpty={t('inspector.decision.secondaryEmpty')}
      secondaryTitle={t('inspector.decision.secondary')}
    />
  );
}