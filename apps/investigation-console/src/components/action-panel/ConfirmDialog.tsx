import { useI18n } from '../../lib/i18n.js';

import type { ActionConfig } from './types.js';

interface ConfirmDialogProps {
  confirmAction: ActionConfig | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ confirmAction, pending, onCancel, onConfirm }: ConfirmDialogProps) {
  const { t } = useI18n();

  if (!confirmAction) {
    return null;
  }

  return (
    <div className="confirm-sheet" data-testid="confirm-dialog">
      <p className="panel-kicker">{t('action.confirmSheet')}</p>
      <h4>{confirmAction.title}</h4>
      <p>{confirmAction.rationale}</p>
      <div className="confirm-actions">
        <button className="ghost-button" onClick={onCancel} type="button">
          {t('action.cancel')}
        </button>
        <button data-testid="confirm-submit" onClick={onConfirm} type="button">
          {pending ? t('action.submitting') : t('action.issueConfirmation')}
        </button>
      </div>
    </div>
  );
}
