import { useEffect, useState } from 'react';

import {
  emptyActionPanelDraftState,
  loadActionPanelDraftState,
  persistActionPanelDraftState,
  type ActionPanelDraftState,
  type ActionPanelNodeDraft
} from '../../lib/case-workspace-storage.js';

import type { ActionConfig } from './types.js';

export function useActionPanelState(caseId: string, selectedNodeId: null | string) {
  const [drafts, setDrafts] = useState<ActionPanelDraftState>(() => loadActionPanelDraftState(caseId));
  const [confirmAction, setConfirmAction] = useState<ActionConfig | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadActionPanelDraftState(caseId));
  }, [caseId]);

  useEffect(() => {
    persistActionPanelDraftState(caseId, drafts);
  }, [caseId, drafts]);

  const nodeDraft = selectedNodeId ? drafts.nodeDrafts[selectedNodeId] ?? {} : {};

  function setCaseDraftValue(field: 'closureDecisionRationale' | 'stageRationale', value: string) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [field]: value
    }));
  }

  function setNodeDraftValue(field: keyof ActionPanelNodeDraft, value: string) {
    if (!selectedNodeId) {
      return;
    }

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      nodeDrafts: {
        ...currentDrafts.nodeDrafts,
        [selectedNodeId]: {
          ...(currentDrafts.nodeDrafts[selectedNodeId] ?? {}),
          [field]: value
        }
      }
    }));
  }

  function resetAllForms() {
    setDrafts(emptyActionPanelDraftState());
  }

  return {
    stageRationale: drafts.stageRationale,
    setStageRationale: (value: string) => setCaseDraftValue('stageRationale', value),
    hypothesisRationale: nodeDraft.hypothesisRationale ?? '',
    setHypothesisRationale: (value: string) => setNodeDraftValue('hypothesisRationale', value),
    newHypothesisStatement: nodeDraft.newHypothesisStatement ?? '',
    setNewHypothesisStatement: (value: string) => setNodeDraftValue('newHypothesisStatement', value),
    newHypothesisFalsification: nodeDraft.newHypothesisFalsification ?? '',
    setNewHypothesisFalsification: (value: string) => setNodeDraftValue('newHypothesisFalsification', value),
    experimentObjective: nodeDraft.experimentObjective ?? '',
    setExperimentObjective: (value: string) => setNodeDraftValue('experimentObjective', value),
    experimentExpectedOutcome: nodeDraft.experimentExpectedOutcome ?? '',
    setExperimentExpectedOutcome: (value: string) => setNodeDraftValue('experimentExpectedOutcome', value),
    experimentResultSummary: nodeDraft.experimentResultSummary ?? '',
    setExperimentResultSummary: (value: string) => setNodeDraftValue('experimentResultSummary', value),
    gapQuestion: nodeDraft.gapQuestion ?? '',
    setGapQuestion: (value: string) => setNodeDraftValue('gapQuestion', value),
    gapResolution: nodeDraft.gapResolution ?? '',
    setGapResolution: (value: string) => setNodeDraftValue('gapResolution', value),
    inquiryResolutionReason: nodeDraft.inquiryResolutionReason ?? '',
    setInquiryResolutionReason: (value: string) => setNodeDraftValue('inquiryResolutionReason', value),
    residualStatement: nodeDraft.residualStatement ?? '',
    setResidualStatement: (value: string) => setNodeDraftValue('residualStatement', value),
    residualRationale: nodeDraft.residualRationale ?? '',
    setResidualRationale: (value: string) => setNodeDraftValue('residualRationale', value),
    decisionRationale: nodeDraft.decisionRationale ?? '',
    setDecisionRationale: (value: string) => setNodeDraftValue('decisionRationale', value),
    closureDecisionRationale: drafts.closureDecisionRationale,
    setClosureDecisionRationale: (value: string) => setCaseDraftValue('closureDecisionRationale', value),
    confirmAction,
    setConfirmAction,
    pending,
    setPending,
    error,
    setError,
    resetAllForms
  };
}
