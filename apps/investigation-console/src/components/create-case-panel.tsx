import { useEffect, useId, useState } from 'react';

import { useI18n } from '../lib/i18n.js';

export interface ManualCaseDraft {
  title: string;
  objective: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  projectDirectory: string;
  labels: string[];
}

interface CreateCasePanelProps {
  error: string | null;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (draft: ManualCaseDraft) => Promise<void>;
}

const INITIAL_DRAFT: ManualCaseDraft = {
  title: '',
  objective: '',
  severity: 'high',
  projectDirectory: '',
  labels: []
};

function tokenizeList(value: string): string[] {
  return value
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function CreateCasePanel(props: CreateCasePanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  const objectiveId = useId();
  const severityId = useId();
  const projectDirectoryId = useId();
  const labelsId = useId();
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [labelsText, setLabelsText] = useState('');

  useEffect(() => {
    if (!props.open) {
      return;
    }

    setDraft(INITIAL_DRAFT);
    setLabelsText('');
  }, [props.open]);

  if (!props.open) {
    return null;
  }

  return (
    <>
      <button
        aria-label={t('caseCreate.close')}
        className="case-create-overlay"
        onClick={props.onClose}
        type="button"
      />

      <aside
        aria-labelledby="create-case-panel-title"
        aria-modal="true"
        className="case-create-panel"
        data-testid="create-case-panel"
        role="dialog"
      >
        <div className="case-create-panel-header">
          <div>
            <h2 id="create-case-panel-title">{t('caseCreate.title')}</h2>
          </div>
          <button className="btn btn-ghost btn-sm case-create-panel-close" onClick={props.onClose} type="button">
            {t('caseCreate.close')}
          </button>
        </div>

        <form
          className="case-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onSubmit(draft);
          }}
        >
          <label className="case-form-field" htmlFor={titleId}>
            <span>{t('caseCreate.fields.title')}</span>
            <input
              aria-label={t('caseCreate.fields.title')}
              autoComplete="off"
              data-testid="create-case-title"
              id={titleId}
              name="title"
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setDraft((current) => ({ ...current, title: nextValue }));
              }}
              placeholder={t('caseCreate.placeholders.title')}
              required
              value={draft.title}
            />
          </label>

          <label className="case-form-field" htmlFor={objectiveId}>
            <span>{t('caseCreate.fields.objective')}</span>
            <textarea
              aria-label={t('caseCreate.fields.objective')}
              data-testid="create-case-objective"
              id={objectiveId}
              name="objective"
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setDraft((current) => ({ ...current, objective: nextValue }));
              }}
              placeholder={t('caseCreate.placeholders.objective')}
              required
              rows={4}
              value={draft.objective}
            />
          </label>

          <div className="case-form-grid">
            <label className="case-form-field" htmlFor={severityId}>
              <span>{t('caseCreate.fields.severity')}</span>
              <select
                aria-label={t('caseCreate.fields.severity')}
                data-testid="create-case-severity"
                id={severityId}
                name="severity"
                onChange={(event) => {
                  const nextValue = event.currentTarget.value as ManualCaseDraft['severity'];
                  setDraft((current) => ({
                    ...current,
                    severity: nextValue
                  }));
                }}
                value={draft.severity}
              >
                <option value="critical">{t('caseCreate.severity.critical')}</option>
                <option value="high">{t('caseCreate.severity.high')}</option>
                <option value="medium">{t('caseCreate.severity.medium')}</option>
                <option value="low">{t('caseCreate.severity.low')}</option>
              </select>
            </label>

          </div>

          <label className="case-form-field" htmlFor={projectDirectoryId}>
            <span>{t('caseCreate.fields.projectDirectory')}</span>
            <input
              aria-label={t('caseCreate.fields.projectDirectory')}
              autoComplete="off"
              data-testid="create-case-project-directory"
              id={projectDirectoryId}
              name="projectDirectory"
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  projectDirectory: nextValue
                }));
              }}
              placeholder={t('caseCreate.placeholders.projectDirectory')}
              required
              value={draft.projectDirectory}
            />
            <small>{t('caseCreate.hints.projectDirectory')}</small>
          </label>

          <label className="case-form-field" htmlFor={labelsId}>
            <span>{t('caseCreate.fields.labels')}</span>
            <input
              aria-label={t('caseCreate.fields.labels')}
              autoComplete="off"
              data-testid="create-case-labels"
              id={labelsId}
              name="labels"
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setLabelsText(nextValue);
                setDraft((current) => ({
                  ...current,
                  labels: tokenizeList(nextValue)
                }));
              }}
              placeholder={t('caseCreate.placeholders.labels')}
              value={labelsText}
            />
            <small>{t('caseCreate.hints.labels')}</small>
            {draft.labels.length > 0 ? (
              <div aria-label={t('caseCreate.preview.labels')} className="case-chip-row">
                {draft.labels.map((item) => (
                  <span className="focus-chip" key={item}>{item}</span>
                ))}
              </div>
            ) : null}
          </label>

          {props.error ? <p className="inline-error">{props.error}</p> : null}

          <div className="case-create-actions">
            <button
              className="btn btn-primary"
              data-testid="create-case-submit"
              disabled={props.pending}
              type="submit"
            >
              {props.pending ? t('caseCreate.submitting') : t('caseCreate.submit')}
            </button>
            <button className="btn btn-ghost" disabled={props.pending} onClick={props.onClose} type="button">
              {t('caseCreate.cancel')}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
