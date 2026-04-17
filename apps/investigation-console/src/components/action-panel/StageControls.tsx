import { useI18n } from '../lib/i18n.js';

interface StageControlsProps {
  caseStage: string | null | undefined;
  currentRevision: number;
  historical: boolean;
  pending: boolean;
  closeCasePass: boolean;
  stageRationale: string;
  closureDecisionRationale: string;
  nextStage: string;
  stageActionTitle: string;
  onStageRationaleChange: (value: string) => void;
  onClosureDecisionRationaleChange: (value: string) => void;
  onAdvanceStage: () => void;
  onCloseCase: () => void;
}

export function StageControls({
  caseStage,
  historical,
  pending,
  closeCasePass,
  stageRationale,
  closureDecisionRationale,
  nextStage,
  stageActionTitle,
  onStageRationaleChange,
  onClosureDecisionRationaleChange,
  onAdvanceStage,
  onCloseCase
}: StageControlsProps) {
  const { t } = useI18n();

  const isCloseCase = nextStage === 'closed';
  const isStageDisabled = historical
    || pending
    || (isCloseCase
      ? closureDecisionRationale.trim().length === 0 || !closeCasePass
      : stageRationale.trim().length === 0);

  return (
    <>
      <label className="search-field">
        <span>{t('action.confirmRationale')}</span>
        <textarea
          data-testid="stage-rationale"
          disabled={historical || pending}
          onChange={(event) => onStageRationaleChange(event.currentTarget.value)}
          placeholder={t('action.confirmPlaceholder')}
          rows={4}
          value={stageRationale}
        />
      </label>
      <button
        className="action-button"
        data-testid="action-advance-stage"
        disabled={isStageDisabled}
        onClick={() => {
          if (isCloseCase) {
            onCloseCase();
            return;
          }

          onAdvanceStage();
        }}
        type="button"
      >
        {stageActionTitle}
      </button>
      {isCloseCase ? (
        <label className="search-field">
          <span>{t('action.closureRationale')}</span>
          <textarea
            data-testid="closure-decision-rationale"
            disabled={historical || pending}
            onChange={(event) => onClosureDecisionRationaleChange(event.currentTarget.value)}
            placeholder={t('action.decisionPlaceholder')}
            rows={3}
            value={closureDecisionRationale}
          />
        </label>
      ) : null}
    </>
  );
}
