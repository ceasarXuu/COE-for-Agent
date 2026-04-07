import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function ResidualInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.residual.primaryEmpty')}
      primaryTitle={t('inspector.residual.primary')}
      secondaryEmpty={t('inspector.residual.secondaryEmpty')}
      secondaryTitle={t('inspector.residual.secondary')}
    />
  );
}