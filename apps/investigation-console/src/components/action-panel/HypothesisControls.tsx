import type { GraphNodeRecord } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

interface HypothesisControlsProps {
  hypothesis: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  readyToPatchPass: boolean;
  defaultInquiryId: string | null | undefined;
  hypothesisRationale: string;
  gapQuestion: string;
  decisionRationale: string;
  experimentObjective: string;
  experimentExpectedOutcome: string;
  onHypothesisRationaleChange: (value: string) => void;
  onGapQuestionChange: (value: string) => void;
  onDecisionRationaleChange: (value: string) => void;
  onExperimentObjectiveChange: (value: string) => void;
  onExperimentExpectedOutcomeChange: (value: string) => void;
  onConfirmHypothesis: () => void;
  onOpenGap: () => void;
  onRecordDecision: () => void;
  onPlanExperiment: () => void;
}

export function HypothesisControls({
  hypothesis,
  historical,
  pending,
  readyToPatchPass,
  defaultInquiryId,
  hypothesisRationale,
  gapQuestion,
  decisionRationale,
  experimentObjective,
  experimentExpectedOutcome,
  onHypothesisRationaleChange,
  onGapQuestionChange,
  onDecisionRationaleChange,
  onExperimentObjectiveChange,
  onExperimentExpectedOutcomeChange,
  onConfirmHypothesis,
  onOpenGap,
  onRecordDecision,
  onPlanExperiment
}: HypothesisControlsProps) {
  const { t } = useI18n();

  return (
    <>
      <label className="search-field">
        <span>{t('action.hypothesisRationale')}</span>
        <textarea
          data-testid="hypothesis-rationale"
          disabled={historical || pending}
          onChange={(event) => onHypothesisRationaleChange(event.currentTarget.value)}
          placeholder={t('action.hypothesisPlaceholder')}
          rows={3}
          value={hypothesisRationale}
        />
      </label>
      <div className="confirm-actions">
        <button
          className="action-button"
          data-testid="action-confirm-hypothesis"
          disabled={historical || pending || hypothesisRationale.trim().length === 0}
          onClick={onConfirmHypothesis}
          type="button"
        >
          {t('action.confirmHypothesis')}
        </button>
        <button
          className="ghost-button"
          data-testid="action-open-gap"
          disabled={historical || pending || gapQuestion.trim().length === 0}
          onClick={onOpenGap}
          type="button"
        >
          {t('action.openGap')}
        </button>
        <button
          className="ghost-button"
          data-testid="action-record-decision"
          disabled={historical || pending || decisionRationale.trim().length === 0}
          onClick={onRecordDecision}
          type="button"
        >
          {t('action.recordDecision')}
        </button>
        <button
          className="ghost-button"
          data-testid="action-plan-experiment"
          disabled={
            historical ||
            pending ||
            experimentObjective.trim().length === 0 ||
            experimentExpectedOutcome.trim().length === 0 ||
            !defaultInquiryId
          }
          onClick={onPlanExperiment}
          type="button"
        >
          {t('action.planExperiment')}
        </button>
      </div>
      <label className="search-field">
        <span>{t('action.gapQuestion')}</span>
        <textarea
          disabled={historical || pending}
          onChange={(event) => onGapQuestionChange(event.currentTarget.value)}
          placeholder={t('action.gapQuestionPlaceholder', { label: hypothesis.label })}
          rows={2}
          value={gapQuestion}
        />
      </label>
      <label className="search-field">
        <span>{t('action.decisionRationale')}</span>
        <textarea
          disabled={historical || pending}
          onChange={(event) => onDecisionRationaleChange(event.currentTarget.value)}
          placeholder={t('action.decisionPlaceholder')}
          rows={2}
          value={decisionRationale}
        />
      </label>
      <label className="search-field">
        <span>{t('action.experimentObjective')}</span>
        <textarea
          data-testid="experiment-objective"
          disabled={historical || pending || !defaultInquiryId}
          onChange={(event) => onExperimentObjectiveChange(event.currentTarget.value)}
          placeholder={t('action.experimentObjectivePlaceholder')}
          rows={2}
          value={experimentObjective}
        />
      </label>
      <label className="search-field">
        <span>{t('action.expectedOutcome')}</span>
        <textarea
          data-testid="experiment-expected-outcome"
          disabled={historical || pending || !defaultInquiryId}
          onChange={(event) => onExperimentExpectedOutcomeChange(event.currentTarget.value)}
          placeholder={t('action.expectedOutcomePlaceholder')}
          rows={2}
          value={experimentExpectedOutcome}
        />
      </label>
    </>
  );
}
