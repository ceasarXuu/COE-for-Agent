import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function RepairAttemptInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.repairAttempt.primaryEmpty')}
      primaryTitle={t('inspector.repairAttempt.primary')}
      secondaryEmpty={t('inspector.repairAttempt.secondaryEmpty')}
      secondaryTitle={t('inspector.repairAttempt.secondary')}
    />
  );
}
