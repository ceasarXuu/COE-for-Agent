import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function GapInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.gap.primaryEmpty')}
      primaryTitle={t('inspector.gap.primary')}
      secondaryEmpty={t('inspector.gap.secondaryEmpty')}
      secondaryTitle={t('inspector.gap.secondary')}
    />
  );
}