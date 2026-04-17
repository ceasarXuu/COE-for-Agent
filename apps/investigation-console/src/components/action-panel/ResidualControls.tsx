import type { GraphNodeRecord } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.js';

interface ResidualControlsProps {
  residual: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  residualRationale: string;
  onResidualRationaleChange: (value: string) => void;
  onAcceptResidual: () => void;
}

export function ResidualControls({
  residual,
  historical,
  pending,
  residualRationale,
  onResidualRationaleChange,
  onAcceptResidual
}: ResidualControlsProps) {
  const { t } = useI18n();

  return (
    <>
      <label className="search-field">
        <span>{t('action.residualRationale')}</span>
        <textarea
          data-testid="residual-rationale"
          disabled={historical || pending}
          onChange={(event) => onResidualRationaleChange(event.currentTarget.value)}
          placeholder={t('action.residualPlaceholder')}
          rows={3}
          value={residualRationale}
        />
      </label>
      <button
        className="ghost-button"
        data-testid="action-accept-residual"
        disabled={historical || pending || residualRationale.trim().length === 0}
        onClick={onAcceptResidual}
        type="button"
      >
        {t('action.acceptResidual')}
      </button>
    </>
  );
}
