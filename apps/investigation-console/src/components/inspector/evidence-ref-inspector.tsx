import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function EvidenceRefInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.evidenceRef.primaryEmpty')}
      primaryTitle={t('inspector.evidenceRef.primary')}
      secondaryEmpty={t('inspector.evidenceRef.secondaryEmpty')}
      secondaryTitle={t('inspector.evidenceRef.secondary')}
    />
  );
}
