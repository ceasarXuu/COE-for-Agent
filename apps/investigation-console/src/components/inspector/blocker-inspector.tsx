import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function BlockerInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.blocker.primaryEmpty')}
      primaryTitle={t('inspector.blocker.primary')}
      secondaryEmpty={t('inspector.blocker.secondaryEmpty')}
      secondaryTitle={t('inspector.blocker.secondary')}
    />
  );
}
