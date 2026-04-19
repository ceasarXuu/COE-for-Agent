import { useI18n } from '../../lib/i18n.js';
import type { GraphNodeRecord } from '../../lib/api.js';
import type { DraftNodePatch, DraftNodeRecord } from './case-node-drafts.js';
import { asObject, asString, asStringArray, type SavedNodeDraftState } from './case-node-editor-persistence.js';
import { splitLines } from '@coe/shared-utils';

export function DraftNodeEditorFields(props: {
  draftNode: DraftNodeRecord;
  evidenceOptions: Array<{ evidenceId: string; title: string }>;
  disabled: boolean;
  onPatchDraftNode: (draftNodeId: string, patch: DraftNodePatch) => void;
}) {
  const { t } = useI18n();
  const payload = asObject(props.draftNode.payload);

  const patchPayload = (nextPayload: Record<string, unknown>) => {
    props.onPatchDraftNode(props.draftNode.id, { payload: nextPayload });
  };

  switch (props.draftNode.kind) {
    case 'hypothesis':
      return (
        <>
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.hypothesis')}
            testId="node-editor-hypothesis-statement"
            value={asString(payload.statement) ?? ''}
            onChange={(value) => patchPayload({ ...payload, statement: value, title: value })}
          />
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.falsificationCriteria')}
            testId="node-editor-hypothesis-falsification"
            value={asStringArray(payload.falsificationCriteria).join('\n')}
            onChange={(value) => patchPayload({ ...payload, falsificationCriteria: splitLines(value) })}
          />
        </>
      );
    case 'blocker':
      return (
        <>
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.blocker')}
            testId="node-editor-blocker-description"
            value={asString(payload.description) ?? ''}
            onChange={(value) => patchPayload({ ...payload, description: value })}
          />
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.possibleWorkarounds')}
            testId="node-editor-blocker-workarounds"
            value={asStringArray(payload.possibleWorkarounds).join('\n')}
            onChange={(value) => patchPayload({ ...payload, possibleWorkarounds: splitLines(value) })}
          />
        </>
      );
    case 'repair_attempt':
      return (
        <>
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.changeSummary')}
            testId="node-editor-repair-summary"
            value={asString(payload.changeSummary) ?? ''}
            onChange={(value) => patchPayload({ ...payload, changeSummary: value })}
          />
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.scope')}
            testId="node-editor-repair-scope"
            value={asString(payload.scope) ?? ''}
            onChange={(value) => patchPayload({ ...payload, scope: value })}
          />
        </>
      );
    case 'evidence_ref': {
      const currentEvidenceId = asString(payload.evidenceId) ?? '';
      return (
        <>
          {props.evidenceOptions.length > 0 ? (
            <EditorSelect
              disabled={props.disabled}
              label={t('canonical.create.existingEvidence')}
              testId="node-editor-evidence-existing"
              value={currentEvidenceId}
              onChange={(value) => {
                const selectedOption = props.evidenceOptions.find((option) => option.evidenceId === value);
                patchPayload({
                  ...payload,
                  evidenceId: value,
                  title: selectedOption?.title ?? asString(payload.title) ?? ''
                });
              }}
              options={[
                { value: '', label: t('canonical.create.captureNew') },
                ...props.evidenceOptions.map((option) => ({ value: option.evidenceId, label: option.title }))
              ]}
            />
          ) : null}
          {currentEvidenceId.length === 0 ? (
            <>
              <EditorTextarea
                disabled={props.disabled}
                label={t('canonical.create.evidenceTitle')}
                testId="node-editor-evidence-title"
                value={asString(payload.title) ?? ''}
                onChange={(value) => patchPayload({ ...payload, title: value })}
              />
              <EditorTextarea
                disabled={props.disabled}
                label={t('canonical.create.summary')}
                testId="node-editor-evidence-summary"
                value={asString(payload.summary) ?? ''}
                onChange={(value) => patchPayload({ ...payload, summary: value })}
              />
              <EditorTextarea
                disabled={props.disabled}
                label={t('canonical.field.environment')}
                testId="node-editor-evidence-provenance"
                value={asString(payload.provenance) ?? ''}
                onChange={(value) => patchPayload({ ...payload, provenance: value })}
              />
            </>
          ) : null}
          <EditorTextarea
            disabled={props.disabled}
            label={t('canonical.create.interpretation')}
            testId="node-editor-evidence-interpretation"
            value={asString(payload.interpretation) ?? ''}
            onChange={(value) => patchPayload({ ...payload, interpretation: value })}
          />
          <EditorSelect
            disabled={props.disabled}
            label={t('canonical.create.effect')}
            testId="node-editor-evidence-effect"
            value={asString(payload.effectOnParent) ?? (props.draftNode.parentKind === 'repair_attempt' ? 'validates' : 'supports')}
            onChange={(value) => patchPayload({ ...payload, effectOnParent: value })}
            options={props.draftNode.parentKind === 'repair_attempt'
              ? [
                  { value: 'validates', label: 'validates' },
                  { value: 'invalidates', label: 'invalidates' },
                  { value: 'neutral', label: 'neutral' }
                ]
              : [
                  { value: 'supports', label: 'supports' },
                  { value: 'refutes', label: 'refutes' },
                  { value: 'neutral', label: 'neutral' }
                ]}
          />
        </>
      );
    }
  }
}

export function SavedNodeEditorFields(props: {
  draft: SavedNodeDraftState;
  selectedNode: GraphNodeRecord | null;
  targetStatus: string;
  statusReason: string;
  statusOptions: string[];
  disabled: boolean;
  onDraftChange: (patch: Partial<SavedNodeDraftState>) => void;
  onStatusChange: (value: string) => void;
  onStatusReasonChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const selectedNode = props.selectedNode;

  if (!selectedNode) {
    return null;
  }

  if (selectedNode.kind === 'problem') {
    return (
      <>
        <EditorInput
          disabled={props.disabled}
          label={t('canonical.field.title')}
          testId="node-editor-problem-title"
          value={props.draft.title}
          onChange={(value) => props.onDraftChange({ title: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('graph.node.problem')}
          testId="node-editor-problem-description"
          value={props.draft.description}
          onChange={(value) => props.onDraftChange({ description: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.environment')}
          testId="node-editor-problem-environment"
          value={props.draft.environment}
          onChange={(value) => props.onDraftChange({ environment: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.symptoms')}
          testId="node-editor-problem-symptoms"
          value={props.draft.symptoms}
          onChange={(value) => props.onDraftChange({ symptoms: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.resolutionCriteria')}
          testId="node-editor-problem-resolution"
          value={props.draft.resolutionCriteria}
          onChange={(value) => props.onDraftChange({ resolutionCriteria: value })}
        />
        <EditorSelect
          disabled={props.disabled}
          label={t('nodeEditor.targetStatus')}
          testId="node-editor-status"
          value={props.targetStatus}
          onChange={props.onStatusChange}
          options={props.statusOptions.map((status) => ({ value: status, label: status }))}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.transitionRationale')}
          testId="node-editor-status-reason"
          value={props.statusReason}
          onChange={props.onStatusReasonChange}
        />
      </>
    );
  }

  if (selectedNode.kind === 'hypothesis') {
    return (
      <>
        <EditorInput
          disabled={props.disabled}
          label={t('canonical.field.title')}
          testId="node-editor-hypothesis-title"
          value={props.draft.title}
          onChange={(value) => props.onDraftChange({ title: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.hypothesis')}
          testId="node-editor-hypothesis-statement"
          value={props.draft.statement}
          onChange={(value) => props.onDraftChange({ statement: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.falsificationCriteria')}
          testId="node-editor-hypothesis-falsification"
          value={props.draft.falsificationCriteria}
          onChange={(value) => props.onDraftChange({ falsificationCriteria: value })}
        />
        <EditorSelect
          disabled={props.disabled}
          label={t('nodeEditor.targetStatus')}
          testId="node-editor-status"
          value={props.targetStatus}
          onChange={props.onStatusChange}
          options={props.statusOptions.map((status) => ({ value: status, label: status }))}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.transitionRationale')}
          testId="node-editor-status-reason"
          value={props.statusReason}
          onChange={props.onStatusReasonChange}
        />
      </>
    );
  }

  if (selectedNode.kind === 'blocker') {
    return (
      <>
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.blocker')}
          testId="node-editor-blocker-description"
          value={props.draft.description}
          onChange={(value) => props.onDraftChange({ description: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.possibleWorkarounds')}
          testId="node-editor-blocker-workarounds"
          value={props.draft.possibleWorkarounds}
          onChange={(value) => props.onDraftChange({ possibleWorkarounds: value })}
        />
        <EditorSelect
          disabled={props.disabled}
          label={t('nodeEditor.targetStatus')}
          testId="node-editor-status"
          value={props.targetStatus}
          onChange={props.onStatusChange}
          options={props.statusOptions.map((status) => ({ value: status, label: status }))}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.closeRationale')}
          testId="node-editor-status-reason"
          value={props.statusReason}
          onChange={props.onStatusReasonChange}
        />
      </>
    );
  }

  if (selectedNode.kind === 'repair_attempt') {
    return (
      <>
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.changeSummary')}
          testId="node-editor-repair-summary"
          value={props.draft.changeSummary}
          onChange={(value) => props.onDraftChange({ changeSummary: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.scope')}
          testId="node-editor-repair-scope"
          value={props.draft.scope}
          onChange={(value) => props.onDraftChange({ scope: value })}
        />
        <EditorSelect
          disabled={props.disabled}
          label={t('nodeEditor.targetStatus')}
          testId="node-editor-status"
          value={props.targetStatus}
          onChange={props.onStatusChange}
          options={props.statusOptions.map((status) => ({ value: status, label: status }))}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.transitionRationale')}
          testId="node-editor-status-reason"
          value={props.statusReason}
          onChange={props.onStatusReasonChange}
        />
      </>
    );
  }

  if (selectedNode.kind === 'evidence_ref') {
    return (
      <>
        <EditorTextarea
          disabled={props.disabled}
          label={t('graph.node.evidence_ref')}
          testId="node-editor-evidence-title"
          value={props.draft.title}
          onChange={(value) => props.onDraftChange({ title: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.summary')}
          testId="node-editor-evidence-summary"
          value={props.draft.summary}
          onChange={(value) => props.onDraftChange({ summary: value })}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.field.environment')}
          testId="node-editor-evidence-provenance"
          value={props.draft.provenance}
          onChange={(value) => props.onDraftChange({ provenance: value })}
        />
        <EditorSelect
          disabled={props.disabled}
          label={t('canonical.create.effect')}
          testId="node-editor-evidence-effect"
          value={props.draft.effectOnParent}
          onChange={(value) => props.onDraftChange({ effectOnParent: value })}
          options={[
            { value: 'supports', label: 'supports' },
            { value: 'refutes', label: 'refutes' },
            { value: 'neutral', label: 'neutral' },
            { value: 'validates', label: 'validates' },
            { value: 'invalidates', label: 'invalidates' }
          ]}
        />
        <EditorTextarea
          disabled={props.disabled}
          label={t('canonical.create.interpretation')}
          testId="node-editor-evidence-interpretation"
          value={props.draft.interpretation}
          onChange={(value) => props.onDraftChange({ interpretation: value })}
        />
      </>
    );
  }

  return null;
}

function EditorInput(props: {
  disabled: boolean;
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="search-field">
      <span>{props.label}</span>
      <input
        data-testid={props.testId}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        type="text"
        value={props.value}
      />
    </label>
  );
}

function EditorTextarea(props: {
  disabled: boolean;
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="search-field">
      <span>{props.label}</span>
      <textarea
        data-testid={props.testId}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        rows={3}
        value={props.value}
      />
    </label>
  );
}

function EditorSelect(props: {
  disabled: boolean;
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="search-field">
      <span>{props.label}</span>
      <select
        data-testid={props.testId}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        value={props.value}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
