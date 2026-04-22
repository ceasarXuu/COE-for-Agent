import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@coe/ui/components/alert';
import { Badge } from '@coe/ui/components/badge';
import { Button } from '@coe/ui/components/button';
import { Separator } from '@coe/ui/components/separator';

import { getCaseEvidencePool, type GraphNodeRecord } from '@/lib/api.js';
import { useI18n } from '@/lib/i18n.js';
import type { DraftNodePatch, DraftNodeRecord } from '@/lib/workspace/case-node-drafts.js';
import { buildNodeEditorSyncKey } from '@/lib/workspace/case-node-editor-selection.js';
import { DraftNodeEditorFields, SavedNodeEditorFields } from '@/components/workspace/node-editor-fields.js';
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
} from '@/lib/workspace/case-node-editor-persistence.js';

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
  const editorSyncKey = buildNodeEditorSyncKey(props.selectedDraftNode, props.selectedNode);

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
      console.info('[investigation-console-v2] node-editor-selection-synced', {
        caseId: props.caseId,
        selection: props.selectedDraftNode
          ? {
              kind: 'draft',
              nodeId: props.selectedDraftNode.id,
              status: props.selectedDraftNode.status
            }
          : null,
        source: 'node-editor'
      });
      return;
    }

    const currentStatus = props.selectedNode.status ?? defaultStatusForKind(props.selectedNode.kind);

    setSavedNodeDraft(buildSavedNodeDraft(props.selectedNode));
    setTargetStatus(currentStatus);
    console.info('[investigation-console-v2] node-editor-selection-synced', {
      caseId: props.caseId,
      selection: {
        kind: props.selectedNode.kind,
        nodeId: props.selectedNode.id,
        revision: props.selectedNode.revision
      },
      source: 'node-editor'
    });
  }, [editorSyncKey, props.caseId]);

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
      <section className="flex h-full min-h-[560px] flex-col" data-testid="node-editor-panel">
        <header className="border-b border-border/70 pb-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('nodeEditor.kicker')}</div>
        </header>
        <div className="flex flex-1 items-center justify-center px-2 text-center text-sm text-muted-foreground" data-testid="node-editor-empty">
          {t('nodeEditor.empty')}
        </div>
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
    <section className="flex h-full min-h-[560px] flex-col" data-testid="node-editor-panel">
      <header className="border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t('nodeEditor.kicker')}</div>
            <h2 className="text-lg font-semibold leading-tight" data-testid="node-editor-title">{selectedNode.label}</h2>
          </div>
          <Badge data-testid="node-editor-current-status" variant={props.selectedDraftNode ? 'secondary' : 'outline'}>
            {selectedStatusLabel}
          </Badge>
        </div>
      </header>

      <div className="flex h-full flex-1 flex-col gap-4 pt-4">
        {props.historical ? (
          <Alert>
            <AlertTitle>{t('action.historicalFrozen')}</AlertTitle>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t('errors.mutationFailed')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-5 pb-4">
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
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {props.selectedDraftNode ? (
            <>
              <Button
                data-testid="node-editor-discard"
                disabled={props.historical || pending}
                onClick={() => props.onDiscardDraftNode(props.selectedDraftNode!.id)}
                type="button"
                variant="outline"
              >
                {t('nodeEditor.discard')}
              </Button>
              <Button
                data-testid="node-editor-save"
                disabled={props.historical || pending || !canSaveDraft}
                onClick={() => void handleSaveDraftNode()}
                type="button"
              >
                {t('nodeEditor.save')}
              </Button>
            </>
          ) : savedNode && savedNode.kind !== 'case' ? (
            <Button
              data-testid="node-editor-save"
              disabled={props.historical || pending || !canSaveExistingNode}
              onClick={() => void handleSaveExistingNode()}
              type="button"
            >
              {t('nodeEditor.save')}
              </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
