import { useState } from 'react';

import type { ActionConfig } from './types.js';

export function useActionPanelState() {
  const [stageRationale, setStageRationale] = useState('');
  const [hypothesisRationale, setHypothesisRationale] = useState('');
  const [newHypothesisStatement, setNewHypothesisStatement] = useState('');
  const [newHypothesisFalsification, setNewHypothesisFalsification] = useState('');
  const [experimentObjective, setExperimentObjective] = useState('');
  const [experimentExpectedOutcome, setExperimentExpectedOutcome] = useState('');
  const [experimentResultSummary, setExperimentResultSummary] = useState('');
  const [gapQuestion, setGapQuestion] = useState('');
  const [gapResolution, setGapResolution] = useState('');
  const [inquiryResolutionReason, setInquiryResolutionReason] = useState('');
  const [residualStatement, setResidualStatement] = useState('');
  const [residualRationale, setResidualRationale] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [closureDecisionRationale, setClosureDecisionRationale] = useState('');
  const [confirmAction, setConfirmAction] = useState<ActionConfig | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAllForms() {
    setStageRationale('');
    setHypothesisRationale('');
    setNewHypothesisStatement('');
    setNewHypothesisFalsification('');
    setExperimentObjective('');
    setExperimentExpectedOutcome('');
    setExperimentResultSummary('');
    setGapQuestion('');
    setGapResolution('');
    setInquiryResolutionReason('');
    setResidualStatement('');
    setResidualRationale('');
    setDecisionRationale('');
    setClosureDecisionRationale('');
  }

  return {
    stageRationale,
    setStageRationale,
    hypothesisRationale,
    setHypothesisRationale,
    newHypothesisStatement,
    setNewHypothesisStatement,
    newHypothesisFalsification,
    setNewHypothesisFalsification,
    experimentObjective,
    setExperimentObjective,
    experimentExpectedOutcome,
    setExperimentExpectedOutcome,
    experimentResultSummary,
    setExperimentResultSummary,
    gapQuestion,
    setGapQuestion,
    gapResolution,
    setGapResolution,
    inquiryResolutionReason,
    setInquiryResolutionReason,
    residualStatement,
    setResidualStatement,
    residualRationale,
    setResidualRationale,
    decisionRationale,
    setDecisionRationale,
    closureDecisionRationale,
    setClosureDecisionRationale,
    confirmAction,
    setConfirmAction,
    pending,
    setPending,
    error,
    setError,
    resetAllForms
  };
}
