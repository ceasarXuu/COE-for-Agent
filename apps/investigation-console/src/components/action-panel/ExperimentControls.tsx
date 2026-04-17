import type { GraphNodeRecord } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.js';

interface ExperimentControlsProps {
  experiment: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  experimentResultSummary: string;
  onExperimentResultSummaryChange: (value: string) => void;
  onRecordExperimentResult: () => void;
}

export function ExperimentControls({
  experiment,
  historical,
  pending,
  experimentResultSummary,
  onExperimentResultSummaryChange,
  onRecordExperimentResult
}: ExperimentControlsProps) {
  const { t } = useI18n();

  return (
    <>
      <label className="search-field">
        <span>{t('action.experimentResult')}</span>
        <textarea
          data-testid="experiment-result-summary"
          disabled={historical || pending}
          onChange={(event) => onExperimentResultSummaryChange(event.currentTarget.value)}
          placeholder={t('action.experimentResultPlaceholder')}
          rows={3}
          value={experimentResultSummary}
        />
      </label>
      <button
        className="action-button"
        data-testid="action-record-experiment-result"
        disabled={historical || pending || experimentResultSummary.trim().length === 0}
        onClick={onRecordExperimentResult}
        type="button"
      >
        {t('action.recordExperimentResult')}
      </button>
    </>
  );
}
