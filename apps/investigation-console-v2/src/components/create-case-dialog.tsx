import { useId, useMemo, useState } from 'react';

import {
  Badge
} from '@coe/ui/components/badge';
import { Button } from '@coe/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@coe/ui/components/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@coe/ui/components/field';
import { Input } from '@coe/ui/components/input';
import {
  NativeSelect,
  NativeSelectOption
} from '@coe/ui/components/native-select';
import { Textarea } from '@coe/ui/components/textarea';

import { useI18n } from '@/lib/i18n.js';

export interface ManualCaseDraft {
  title: string;
  objective: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  projectDirectory: string;
  labels: string[];
}

interface CreateCaseDialogProps {
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: ManualCaseDraft) => Promise<void> | void;
  open: boolean;
  pending: boolean;
}

const DEFAULT_SEVERITY: ManualCaseDraft['severity'] = 'medium';

function tokenizeList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function CreateCaseDialog(props: CreateCaseDialogProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState({
    title: '',
    objective: '',
    severity: DEFAULT_SEVERITY,
    projectDirectory: '',
    labelsRaw: ''
  });

  const titleId = useId();
  const objectiveId = useId();
  const severityId = useId();
  const projectDirectoryId = useId();
  const labelsId = useId();
  const labels = useMemo(() => tokenizeList(draft.labelsRaw), [draft.labelsRaw]);
  const canSubmit = draft.title.trim().length > 0
    && draft.objective.trim().length > 0
    && draft.projectDirectory.trim().length > 0;

  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open && !props.pending) props.onClose(); }}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0" showCloseButton={!props.pending}>
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{t('caseCreate.title')}</DialogTitle>
          <DialogDescription>{t('snapshot.defaultObjective')}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-6 px-6 py-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit || props.pending) {
              return;
            }

            void props.onSubmit({
              title: draft.title.trim(),
              objective: draft.objective.trim(),
              severity: draft.severity,
              projectDirectory: draft.projectDirectory.trim(),
              labels
            });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={titleId}>{t('caseCreate.fields.title')}</FieldLabel>
              <Input
                id={titleId}
                autoComplete="off"
                data-testid="create-case-title"
                disabled={props.pending}
                placeholder={t('caseCreate.placeholders.title')}
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.currentTarget.value }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={objectiveId}>{t('caseCreate.fields.objective')}</FieldLabel>
              <Textarea
                id={objectiveId}
                data-testid="create-case-objective"
                disabled={props.pending}
                placeholder={t('caseCreate.placeholders.objective')}
                rows={5}
                value={draft.objective}
                onChange={(event) => setDraft((current) => ({ ...current, objective: event.currentTarget.value }))}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <Field>
                <FieldLabel htmlFor={severityId}>{t('caseCreate.fields.severity')}</FieldLabel>
                <NativeSelect
                  id={severityId}
                  data-testid="create-case-severity"
                  disabled={props.pending}
                  value={draft.severity}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    severity: event.currentTarget.value as ManualCaseDraft['severity']
                  }))}
                >
                  <NativeSelectOption value="critical">{t('caseCreate.severity.critical')}</NativeSelectOption>
                  <NativeSelectOption value="high">{t('caseCreate.severity.high')}</NativeSelectOption>
                  <NativeSelectOption value="medium">{t('caseCreate.severity.medium')}</NativeSelectOption>
                  <NativeSelectOption value="low">{t('caseCreate.severity.low')}</NativeSelectOption>
                </NativeSelect>
              </Field>

              <Field>
                <FieldLabel htmlFor={projectDirectoryId}>{t('caseCreate.fields.projectDirectory')}</FieldLabel>
                <Input
                  id={projectDirectoryId}
                  data-testid="create-case-project-directory"
                  disabled={props.pending}
                  placeholder={t('caseCreate.placeholders.projectDirectory')}
                  value={draft.projectDirectory}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    projectDirectory: event.currentTarget.value
                  }))}
                />
                <FieldDescription>{t('caseCreate.hints.projectDirectory')}</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor={labelsId}>{t('caseCreate.fields.labels')}</FieldLabel>
              <Input
                id={labelsId}
                data-testid="create-case-labels"
                disabled={props.pending}
                placeholder={t('caseCreate.placeholders.labels')}
                value={draft.labelsRaw}
                onChange={(event) => setDraft((current) => ({ ...current, labelsRaw: event.currentTarget.value }))}
              />
              <FieldDescription>{t('caseCreate.hints.labels')}</FieldDescription>
            </Field>
          </FieldGroup>

          {labels.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t('caseCreate.preview.labels')}</span>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <Badge key={label} variant="outline">{label}</Badge>
                ))}
              </div>
            </div>
          ) : null}

          {props.error ? <FieldError>{props.error}</FieldError> : null}

          <DialogFooter className="mx-0 mb-0 rounded-b-none border-t bg-muted/30 px-0 pb-0 pt-4">
            <Button disabled={props.pending} type="button" variant="outline" onClick={props.onClose}>
              {t('caseCreate.cancel')}
            </Button>
            <Button data-testid="create-case-submit" disabled={!canSubmit || props.pending} type="submit">
              {props.pending ? t('caseCreate.submitting') : t('caseCreate.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
