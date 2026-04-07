import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function ExperimentInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.experiment.primaryEmpty')}
      primaryTitle={t('inspector.experiment.primary')}
      secondaryEmpty={t('inspector.experiment.secondaryEmpty')}
      secondaryTitle={t('inspector.experiment.secondary')}
    />
  );
}