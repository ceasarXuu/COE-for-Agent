import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function FactInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.fact.primaryEmpty')}
      primaryTitle={t('inspector.observedAbout')}
      secondaryEmpty={t('inspector.fact.secondaryEmpty')}
      secondaryTitle={t('inspector.followOn')}
    />
  );
}