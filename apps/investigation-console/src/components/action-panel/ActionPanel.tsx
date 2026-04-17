import { useI18n } from '../lib/i18n.js';

import { ConfirmDialog } from './ConfirmDialog.js';
import { ExperimentControls } from './ExperimentControls.js';
import { GapControls } from './GapControls.js';
import { HypothesisControls } from './HypothesisControls.js';
import { InquiryControls } from './InquiryControls.js';
import { ResidualControls } from './ResidualControls.js';
import { StageControls } from './StageControls.js';
import { SymptomControls } from './SymptomControls.js';
import type { ActionPanelProps } from './types.js';
import { useActionHandlers } from './useActionHandlers.js';
import { useActionPanelState } from './useActionPanelState.js';

export function ActionPanel(props: ActionPanelProps) {
  const { t } = useI18n();
  const state = useActionPanelState();

  const handlers = useActionHandlers({
    ...props,
    ...state
  });

  return (
    <section className="panel panel-primary action-panel" data-testid="action-panel">
      <p className="panel-kicker">{t('action.kicker')}</p>
      {props.historical ? <p className="history-banner">{t('action.historicalFrozen')}</p> : null}
      {state.error ? <p className="inline-error">{state.error}</p> : null}

      <StageControls
        caseStage={props.caseStage}
        currentRevision={props.currentRevision}
        historical={props.historical}
        pending={state.pending}
        closeCasePass={handlers.closeCasePass}
        stageRationale={state.stageRationale}
        closureDecisionRationale={state.closureDecisionRationale}
        nextStage={handlers.nextStage}
        stageActionTitle={handlers.stageActionTitle}
        onStageRationaleChange={state.setStageRationale}
        onClosureDecisionRationaleChange={state.setClosureDecisionRationale}
        onAdvanceStage={() => handlers.queueOrExecute(handlers.stageAction)}
        onCloseCase={handlers.executeCloseCaseFlow}
      />

      {handlers.selectedNode?.kind === 'hypothesis' ? (
        <HypothesisControls
          hypothesis={handlers.selectedNode}
          historical={props.historical}
          pending={state.pending}
          readyToPatchPass={handlers.readyToPatchPass}
          defaultInquiryId={props.defaultInquiryId}
          hypothesisRationale={state.hypothesisRationale}
          gapQuestion={state.gapQuestion}
          decisionRationale={state.decisionRationale}
          experimentObjective={state.experimentObjective}
          experimentExpectedOutcome={state.experimentExpectedOutcome}
          onHypothesisRationaleChange={state.setHypothesisRationale}
          onGapQuestionChange={state.setGapQuestion}
          onDecisionRationaleChange={state.setDecisionRationale}
          onExperimentObjectiveChange={state.setExperimentObjective}
          onExperimentExpectedOutcomeChange={state.setExperimentExpectedOutcome}
          onConfirmHypothesis={() => handlers.hypothesisConfirmAction && handlers.queueOrExecute(handlers.hypothesisConfirmAction)}
          onOpenGap={() => handlers.hypothesisGapAction && handlers.queueOrExecute(handlers.hypothesisGapAction)}
          onRecordDecision={() => handlers.hypothesisDecisionAction && handlers.queueOrExecute(handlers.hypothesisDecisionAction)}
          onPlanExperiment={() => handlers.hypothesisExperimentAction && handlers.queueOrExecute(handlers.hypothesisExperimentAction)}
        />
      ) : null}

      {handlers.selectedNode?.kind === 'symptom' ? (
        <SymptomControls
          symptom={handlers.selectedNode}
          historical={props.historical}
          pending={state.pending}
          defaultInquiryId={props.defaultInquiryId}
          newHypothesisStatement={state.newHypothesisStatement}
          newHypothesisFalsification={state.newHypothesisFalsification}
          residualStatement={state.residualStatement}
          onNewHypothesisStatementChange={state.setNewHypothesisStatement}
          onNewHypothesisFalsificationChange={state.setNewHypothesisFalsification}
          onResidualStatementChange={state.setResidualStatement}
          onProposeHypothesis={() => handlers.symptomHypothesisAction && handlers.queueOrExecute(handlers.symptomHypothesisAction)}
          onOpenResidual={() => handlers.symptomResidualAction && handlers.queueOrExecute(handlers.symptomResidualAction)}
        />
      ) : null}

      {handlers.selectedNode?.kind === 'experiment' ? (
        <ExperimentControls
          experiment={handlers.selectedNode}
          historical={props.historical}
          pending={state.pending}
          experimentResultSummary={state.experimentResultSummary}
          onExperimentResultSummaryChange={state.setExperimentResultSummary}
          onRecordExperimentResult={() => handlers.experimentResultAction && handlers.queueOrExecute(handlers.experimentResultAction)}
        />
      ) : null}

      {handlers.selectedNode?.kind === 'inquiry' ? (
        <InquiryControls
          inquiry={handlers.selectedNode}
          historical={props.historical}
          pending={state.pending}
          inquiryResolutionReason={state.inquiryResolutionReason}
          onInquiryResolutionReasonChange={state.setInquiryResolutionReason}
          onCloseInquiry={() => handlers.inquiryCloseAction && handlers.queueOrExecute(handlers.inquiryCloseAction)}
        />
      ) : null}

      {handlers.selectedNode?.kind === 'gap' ? (
        <GapControls
          gap={handlers.selectedNode}
          historical={props.historical}
          pending={state.pending}
          gapResolution={state.gapResolution}
          onGapResolutionChange={state.setGapResolution}
          onResolveGap={() => handlers.gapResolveAction && handlers.queueOrExecute(handlers.gapResolveAction)}
        />
      ) : null}

      {handlers.selectedNode?.kind === 'residual' ? (
        <ResidualControls
          residual={handlers.selectedNode}
          historical={props.historical}
          pending={state.pending}
          residualRationale={state.residualRationale}
          onResidualRationaleChange={state.setResidualRationale}
          onAcceptResidual={() => handlers.residualAcceptAction && handlers.queueOrExecute(handlers.residualAcceptAction)}
        />
      ) : null}

      <ConfirmDialog
        confirmAction={state.confirmAction}
        pending={state.pending}
        onCancel={() => state.setConfirmAction(null)}
        onConfirm={handlers.submitConfirmedAction}
      />
    </section>
  );
}
