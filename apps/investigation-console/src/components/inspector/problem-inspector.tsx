import type { InspectorViewModel } from '../inspector-panel.js';
import { useI18n } from '../../lib/i18n.js';
import { InspectorShell } from './inspector-shell.js';

export function ProblemInspector(props: { inspector: InspectorViewModel }) {
  const { t } = useI18n();

  return (
    <InspectorShell
      inspector={props.inspector}
      primaryEmpty={t('inspector.problem.primaryEmpty')}
      primaryTitle={t('inspector.problem.primary')}
      secondaryEmpty={t('inspector.problem.secondaryEmpty')}
      secondaryTitle={t('inspector.problem.secondary')}
    />
  );
}
