import { useEffect, useMemo, useState } from 'react';

import { getCaseEvidencePool, type GraphNodeRecord } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.js';
import type { DraftNodePatch, DraftNodeRecord } from './case-node-drafts.js';
import { DraftNodeEditorFields, SavedNodeEditorFields } from './case-node-editor-fields.js';
import {
  buildSavedNodeDraft,
  createEmptySavedNodeDraft,
  defaultStatusForKind,
  draftNodeCanSave,
  findCreatedNodeId,
  getStatusOptions,
  persistDraftNode,
  persistSavedNodeDraft,
  persistStatusChange,
  requiresReason,
  serializeSavedNodeDraft,
  type SavedNodeDraftState
} from './case-node-editor-persistence.js';

interface CaseNodeEditorProps {
  caseId: string;
  currentRevision: number;
  historical: boolean;
  selectedNode: GraphNodeRecord | null;
  selectedDraftNode: DraftNodeRecord | null;
  onPatchDraftNode: (draftNodeId: string, patch: DraftNodePatch) => void;
  onDiscardDraftNode: (draftNodeId: string) => void;
  onMutationComplete: () => Promise<void> | void;
}

export function CaseNodeEditor(props: CaseNodeEditorProps) {
  const { formatEnumLabel, t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNodeDraft, setSavedNodeDraft] = useState<SavedNodeDraftState>(createEmptySavedNodeDraft());
  const [statusReason, setStatusReason] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [evidenceOptions, setEvidenceOptions] = useState<Array<{ evidenceId: string; title: string }>>([]);

  useEffect(() => {
    if (!props.caseId) {
      setEvidenceOptions([]);
      return;
    }

    let cancelled = false;
    void getCaseEvidencePool(props.caseId)
      .then((resource) => {
        if (!cancelled) {
          setEvidenceOptions(resource.data.items.map((item) => ({
            evidenceId: item.evidenceId,
            title: item.title
          })));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvidenceOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.caseId, props.currentRevision]);

  useEffect(() => {
    setError(null);
    setStatusReason('');

    if (props.selectedDraftNode || !props.selectedNode) {
      setSavedNodeDraft(createEmptySavedNodeDraft());
      setTargetStatus('');
      return;
    }

    const currentStatus = props.selectedNode.status ?? defaultStatusForKind(props.selectedNode.kind);

    setSavedNodeDraft(buildSavedNodeDraft(props.selectedNode));
    setTargetStatus(currentStatus);
  }, [props.selectedDraftNode, props.selectedNode]);

  const selectedNode = props.selectedDraftNode ?? props.selectedNode;
  const savedNode = props.selectedDraftNode ? null : props.selectedNode;
  const selectedStatusLabel = props.selectedDraftNode
    ? t(props.selectedDraftNode.status === 'saving' ? 'nodeEditor.saving' : 'nodeEditor.unsaved')
    : formatEnumLabel(savedNode?.status ?? 'stateless');

  const currentProblemSnapshot = useMemo(() => {
    if (!savedNode) {
      return '';
    }

    return serializeSavedNodeDraft(savedNode, buildSavedNodeDraft(savedNode));
  }, [savedNode]);
  const savedNodeDraftSnapshot = useMemo(
    () => savedNode ? serializeSavedNodeDraft(savedNode, savedNodeDraft) : '',
    [savedNode, savedNodeDraft]
  );

  if (!selectedNode) {
    return (
      <section className="panel panel-primary node-editor-panel" data-testid="node-editor-panel">
        <p className="panel-kicker">{t('nodeEditor.kicker')}</p>
        <p data-testid="node-editor-empty">{t('nodeEditor.empty')}</p>
      </section>
    );
  }

  const statusOptions = savedNode ? getStatusOptions(savedNode.kind, savedNode.status) : [];
  const statusChanged = savedNode ? targetStatus !== (savedNode.status ?? defaultStatusForKind(savedNode.kind)) : false;
  const requiresStatusReason = statusChanged && requiresReason(savedNode?.kind ?? null, targetStatus);
  const contentChanged = savedNode ? savedNodeDraftSnapshot !== currentProblemSnapshot : false;
  const canSaveExistingNode = savedNode !== null
    ? contentChanged || (statusChanged && (!requiresStatusReason || statusReason.trim().length > 0))
    : false;
  const canSaveDraft = props.selectedDraftNode ? draftNodeCanSave(props.selectedDraftNode) : false;

  async function handleSaveExistingNode() {
    if (!savedNode || props.historical) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      let nextRevision = props.currentRevision;

      if (contentChanged) {
        const updateResult = await persistSavedNodeDraft({
          caseId: props.caseId,
          currentRevision: nextRevision,
          node: savedNode,
          draft: savedNodeDraft
        });
        nextRevision = updateResult.headRevisionAfter;
      }

      if (statusChanged) {
        nextRevision = await persistStatusChange({
          caseId: props.caseId,
          currentRevision: nextRevision,
          node: savedNode,
          targetStatus,
          reason: statusReason
        });
      }

      if (canSaveExistingNode) {
        await props.onMutationComplete();
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      setPending(false);
    }
  }

  async function handleSaveDraftNode() {
    if (!props.selectedDraftNode || props.historical || !canSaveDraft) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await persistDraftNode({
        caseId: props.caseId,
        currentRevision: props.currentRevision,
        draftNode: props.selectedDraftNode
      });

      props.onPatchDraftNode(props.selectedDraftNode.id, {
        persistedNodeId: findCreatedNodeId(result.createdIds ?? [], props.selectedDraftNode.kind),
        status: 'saving'
      });
      await props.onMutationComplete();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel panel-primary node-editor-panel" data-testid="node-editor-panel">
      <div className="node-editor-header">
        <div>
          <p className="panel-kicker">{t('nodeEditor.kicker')}</p>
          <h3 data-testid="node-editor-title">{selectedNode.label}</h3>
        </div>
        <span className="focus-chip" data-testid="node-editor-current-status">
          {selectedStatusLabel}
        </span>
      </div>

      {props.historical ? <p className="history-banner">{t('action.historicalFrozen')}</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}

      {props.selectedDraftNode ? (
        <DraftNodeEditorFields
          disabled={props.historical || pending}
          draftNode={props.selectedDraftNode}
          evidenceOptions={evidenceOptions}
          onPatchDraftNode={props.onPatchDraftNode}
        />
      ) : (
        <SavedNodeEditorFields
          disabled={props.historical || pending}
          draft={savedNodeDraft}
          selectedNode={savedNode}
          statusOptions={statusOptions}
          statusReason={statusReason}
          targetStatus={targetStatus}
          onDraftChange={(patch) => setSavedNodeDraft((currentValue) => ({ ...currentValue, ...patch }))}
          onStatusChange={setTargetStatus}
          onStatusReasonChange={setStatusReason}
        />
      )}

      <div className="node-editor-actions">
        {props.selectedDraftNode ? (
          <>
            <button
              className="action-button"
              data-testid="node-editor-save"
              disabled={props.historical || pending || !canSaveDraft}
              onClick={() => void handleSaveDraftNode()}
              type="button"
            >
              {t('nodeEditor.save')}
            </button>
            <button
              className="ghost-button"
              data-testid="node-editor-discard"
              disabled={props.historical || pending}
              onClick={() => props.onDiscardDraftNode(props.selectedDraftNode!.id)}
              type="button"
            >
              {t('nodeEditor.discard')}
            </button>
          </>
        ) : savedNode && savedNode.kind !== 'case' ? (
          <button
            className="action-button"
            data-testid="node-editor-save"
            disabled={props.historical || pending || !canSaveExistingNode}
            onClick={() => void handleSaveExistingNode()}
            type="button"
          >
            {t('nodeEditor.save')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
