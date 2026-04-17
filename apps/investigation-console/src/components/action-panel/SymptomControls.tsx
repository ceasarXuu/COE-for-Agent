import type { GraphNodeRecord } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

interface SymptomControlsProps {
  symptom: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  defaultInquiryId: string | null | undefined;
  newHypothesisStatement: string;
  newHypothesisFalsification: string;
  residualStatement: string;
  onNewHypothesisStatementChange: (value: string) => void;
  onNewHypothesisFalsificationChange: (value: string) => void;
  onResidualStatementChange: (value: string) => void;
  onProposeHypothesis: () => void;
  onOpenResidual: () => void;
}

export function SymptomControls({
  symptom,
  historical,
  pending,
  defaultInquiryId,
  newHypothesisStatement,
  newHypothesisFalsification,
  residualStatement,
  onNewHypothesisStatementChange,
  onNewHypothesisFalsificationChange,
  onResidualStatementChange,
  onProposeHypothesis,
  onOpenResidual
}: SymptomControlsProps) {
  const { t } = useI18n();

  return (
    <>
      <label className="search-field">
        <span>{t('action.newHypothesis')}</span>
        <textarea
          data-testid="new-hypothesis-statement"
          disabled={historical || pending || !defaultInquiryId}
          onChange={(event) => onNewHypothesisStatementChange(event.currentTarget.value)}
          placeholder={t('action.newHypothesisPlaceholder', { label: symptom.label })}
          rows={3}
          value={newHypothesisStatement}
        />
      </label>
      <label className="search-field">
        <span>{t('action.falsificationCriteria')}</span>
        <textarea
          data-testid="new-hypothesis-falsification"
          disabled={historical || pending || !defaultInquiryId}
          onChange={(event) => onNewHypothesisFalsificationChange(event.currentTarget.value)}
          placeholder={t('action.falsificationPlaceholder')}
          rows={2}
          value={newHypothesisFalsification}
        />
      </label>
      <div className="confirm-actions">
        <button
          className="action-button"
          data-testid="action-propose-hypothesis"
          disabled={
            historical ||
            pending ||
            newHypothesisStatement.trim().length === 0 ||
            newHypothesisFalsification.trim().length === 0 ||
            !defaultInquiryId
          }
          onClick={onProposeHypothesis}
          type="button"
        >
          {t('action.proposeHypothesis')}
        </button>
        <button
          className="ghost-button"
          data-testid="action-open-residual"
          disabled={historical || pending || residualStatement.trim().length === 0}
          onClick={onOpenResidual}
          type="button"
        >
          {t('action.openResidual')}
        </button>
      </div>
      <label className="search-field">
        <span>{t('action.residualStatement')}</span>
        <textarea
          data-testid="residual-statement"
          disabled={historical || pending}
          onChange={(event) => onResidualStatementChange(event.currentTarget.value)}
          placeholder={t('action.residualStatementPlaceholder', { label: symptom.label })}
          rows={2}
          value={residualStatement}
        />
      </label>
    </>
  );
}
