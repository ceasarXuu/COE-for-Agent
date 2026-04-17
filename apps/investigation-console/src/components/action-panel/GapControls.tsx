import type { GraphNodeRecord } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

interface GapControlsProps {
  gap: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  gapResolution: string;
  onGapResolutionChange: (value: string) => void;
  onResolveGap: () => void;
}

export function GapControls({
  gap,
  historical,
  pending,
  gapResolution,
  onGapResolutionChange,
  onResolveGap
}: GapControlsProps) {
  const { t } = useI18n();

  return (
    <>
      <label className="search-field">
        <span>{t('action.gapResolution')}</span>
        <textarea
          data-testid="gap-resolution-rationale"
          disabled={historical || pending}
          onChange={(event) => onGapResolutionChange(event.currentTarget.value)}
          placeholder={t('action.gapResolutionPlaceholder')}
          rows={3}
          value={gapResolution}
        />
      </label>
      <button
        className="action-button"
        data-testid="action-resolve-gap"
        disabled={historical || pending || gapResolution.trim().length === 0}
        onClick={onResolveGap}
        type="button"
      >
        {t('action.resolveGap')}
      </button>
    </>
  );
}
