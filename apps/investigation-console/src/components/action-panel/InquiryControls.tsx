import type { GraphNodeRecord } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

interface InquiryControlsProps {
  inquiry: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'>;
  historical: boolean;
  pending: boolean;
  inquiryResolutionReason: string;
  onInquiryResolutionReasonChange: (value: string) => void;
  onCloseInquiry: () => void;
}

export function InquiryControls({
  inquiry,
  historical,
  pending,
  inquiryResolutionReason,
  onInquiryResolutionReasonChange,
  onCloseInquiry
}: InquiryControlsProps) {
  const { t } = useI18n();

  return (
    <>
      <label className="search-field">
        <span>{t('action.inquiryResolution')}</span>
        <textarea
          data-testid="inquiry-resolution-reason"
          disabled={historical || pending}
          onChange={(event) => onInquiryResolutionReasonChange(event.currentTarget.value)}
          placeholder={t('action.inquiryResolutionPlaceholder')}
          rows={3}
          value={inquiryResolutionReason}
        />
      </label>
      <button
        className="ghost-button"
        data-testid="action-close-inquiry"
        disabled={historical || pending || inquiryResolutionReason.trim().length === 0}
        onClick={onCloseInquiry}
        type="button"
      >
        {t('action.closeInquiry')}
      </button>
    </>
  );
}
