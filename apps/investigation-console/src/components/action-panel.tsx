import { useState } from 'react';

import { buildIdempotencyKey } from '@coe/shared-utils';

import type { GraphNodeRecord, GuardrailBundle } from '../lib/api.js';
import { invokeTool, requestConfirmIntent } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

interface ActionConfig {
  commandName:
    | 'investigation.case.advance_stage'
    | 'investigation.hypothesis.propose'
    | 'investigation.hypothesis.update_status'
    | 'investigation.experiment.plan'
    | 'investigation.experiment.record_result'
    | 'investigation.inquiry.close'
    | 'investigation.gap.open'
    | 'investigation.gap.resolve'
    | 'investigation.residual.open'
    | 'investigation.residual.update'
    | 'investigation.decision.record';
  title: string;
  rationale: string;
  requiresConfirm: boolean;
  targetIds: string[];
  payload: Record<string, unknown>;
  reset: () => void;
}

export function ActionPanel(props: {
  caseId: string;
  caseStage?: string | null;
  defaultInquiryId?: string | null;
  currentRevision: number;
  historical: boolean;
  selectedNode?: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'> | null;
  guardrails?: GuardrailBundle | null;
  onMutationComplete: () => Promise<void> | void;
}) {
  const { t } = useI18n();
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

  async function executeAction(action: ActionConfig, confirmToken?: string) {
    setPending(true);
    setError(null);

    try {
      await invokeTool(action.commandName, {
        ...action.payload,
        ...(confirmToken ? { confirmToken } : {})
      });

      setConfirmAction(null);
      action.reset();
      await props.onMutationComplete();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      setPending(false);
    }
  }

  async function submitConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const confirmation = await requestConfirmIntent({
        commandName: confirmAction.commandName,
        caseId: props.caseId,
        targetIds: confirmAction.targetIds,
        rationale: confirmAction.rationale
      });

      await executeAction(confirmAction, confirmation.confirmToken);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
      setPending(false);
    }
  }

  async function executeCloseCaseFlow() {
    if (props.caseStage !== 'repair_validation') {
      return;
    }

    const rationale = closureDecisionRationale.trim();
    if (rationale.length === 0) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const closeDecisionConfirmation = await requestConfirmIntent({
        commandName: 'investigation.decision.record',
        caseId: props.caseId,
        targetIds: [props.caseId],
        rationale
      });

      const closeDecisionResult = await invokeTool<{ headRevisionAfter: number }>('investigation.decision.record', {
        caseId: props.caseId,
        ifCaseRevision: props.currentRevision,
        title: t('action.closeReady'),
        decisionKind: 'close_case',
        statement: rationale,
        rationale,
        idempotencyKey: buildIdempotencyKey('decision-close-case'),
        confirmToken: closeDecisionConfirmation.confirmToken
      });

      const closeCaseConfirmation = await requestConfirmIntent({
        commandName: 'investigation.case.advance_stage',
        caseId: props.caseId,
        targetIds: [props.caseId],
        rationale
      });

      await invokeTool('investigation.case.advance_stage', {
        caseId: props.caseId,
        ifCaseRevision: closeDecisionResult.headRevisionAfter,
        stage: 'closed',
        reason: rationale,
        idempotencyKey: buildIdempotencyKey('case-close'),
        confirmToken: closeCaseConfirmation.confirmToken
      });

      setClosureDecisionRationale('');
      await props.onMutationComplete();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      setPending(false);
    }
  }

  function queueOrExecute(action: ActionConfig) {
    if (action.requiresConfirm) {
      setConfirmAction(action);
      return;
    }

    void executeAction(action);
  }

  const closeCasePass = props.guardrails?.closeCase.pass === true;
  const nextStage = props.caseStage === 'repair_preparation'
    ? 'repair_validation'
    : props.caseStage === 'repair_validation'
      ? 'closed'
      : 'repair_preparation';
  const stageActionTitle = nextStage === 'repair_validation'
    ? t('action.advanceValidation')
    : nextStage === 'closed'
      ? t('action.closeCase')
      : t('action.advance');

  const stageAction: ActionConfig = {
    commandName: 'investigation.case.advance_stage',
    title: stageActionTitle,
    rationale: stageRationale,
    requiresConfirm: true,
    targetIds: [props.caseId],
    payload: {
      caseId: props.caseId,
      ifCaseRevision: props.currentRevision,
      stage: nextStage,
      reason: stageRationale,
      idempotencyKey: buildIdempotencyKey(`case-stage-${nextStage}`)
    },
    reset: () => setStageRationale('')
  };

  const selectedNode = props.selectedNode ?? null;
  const readyToPatchPass = props.guardrails?.readyToPatch.pass === true;

  const hypothesisConfirmAction = selectedNode?.kind === 'hypothesis'
    ? {
        commandName: 'investigation.hypothesis.update_status',
        title: t('action.confirmHypothesis'),
        rationale: hypothesisRationale,
        requiresConfirm: true,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          hypothesisId: selectedNode.id,
          newStatus: 'confirmed',
          reason: hypothesisRationale,
          idempotencyKey: buildIdempotencyKey('hypothesis-confirm')
        },
        reset: () => setHypothesisRationale('')
      } satisfies ActionConfig
    : null;

  const symptomHypothesisAction = selectedNode?.kind === 'symptom' && props.defaultInquiryId
    ? {
        commandName: 'investigation.hypothesis.propose',
        title: t('action.proposeHypothesis'),
        rationale: newHypothesisStatement,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          inquiryId: props.defaultInquiryId,
          title: t('action.generatedHypothesisTitle', { label: selectedNode.label }),
          statement: newHypothesisStatement,
          level: 'mechanism',
          explainsSymptomIds: [selectedNode.id],
          dependsOnFactIds: [],
          falsificationCriteria: [newHypothesisFalsification],
          idempotencyKey: buildIdempotencyKey('hypothesis-propose')
        },
        reset: () => {
          setNewHypothesisStatement('');
          setNewHypothesisFalsification('');
        }
      } satisfies ActionConfig
    : null;

  const symptomResidualAction = selectedNode?.kind === 'symptom'
    ? {
        commandName: 'investigation.residual.open',
        title: t('action.openResidual'),
        rationale: residualStatement,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          statement: residualStatement,
          severity: 'high',
          relatedSymptomIds: [selectedNode.id],
          idempotencyKey: buildIdempotencyKey('residual-open')
        },
        reset: () => setResidualStatement('')
      } satisfies ActionConfig
    : null;

  const hypothesisGapAction = selectedNode?.kind === 'hypothesis'
    ? {
        commandName: 'investigation.gap.open',
        title: t('action.openInvestigationGap'),
        rationale: gapQuestion,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          question: gapQuestion,
          priority: 'high',
          blockedRefs: [selectedNode.id],
          idempotencyKey: buildIdempotencyKey('gap-open')
        },
        reset: () => setGapQuestion('')
      } satisfies ActionConfig
    : null;

  const hypothesisExperimentAction = selectedNode?.kind === 'hypothesis' && props.defaultInquiryId
    ? {
        commandName: 'investigation.experiment.plan',
        title: t('action.planExperiment'),
        rationale: experimentObjective,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          inquiryId: props.defaultInquiryId,
          title: t('action.generatedExperimentTitle', { label: selectedNode.label }),
          objective: experimentObjective,
          method: 'patch_probe',
          testsHypothesisIds: [selectedNode.id],
          expectedOutcomes: [
            {
              when: t('action.experimentWhen'),
              expect: experimentExpectedOutcome
            }
          ],
          idempotencyKey: buildIdempotencyKey('experiment-plan')
        },
        reset: () => {
          setExperimentObjective('');
          setExperimentExpectedOutcome('');
        }
      } satisfies ActionConfig
    : null;

  const hypothesisDecisionAction = selectedNode?.kind === 'hypothesis'
    ? {
        commandName: 'investigation.decision.record',
        title: t('action.recordReadiness'),
        rationale: decisionRationale,
        requiresConfirm: readyToPatchPass,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          title: readyToPatchPass ? t('action.readinessReady') : t('action.readinessBranch'),
          decisionKind: readyToPatchPass ? 'ready_to_patch' : 'deprioritize_branch',
          statement: decisionRationale,
          supportingHypothesisIds: [selectedNode.id],
          rationale: decisionRationale,
          idempotencyKey: buildIdempotencyKey('decision-record')
        },
        reset: () => setDecisionRationale('')
      } satisfies ActionConfig
    : null;

  const gapResolveAction = selectedNode?.kind === 'gap'
    ? {
        commandName: 'investigation.gap.resolve',
        title: t('action.resolveGap'),
        rationale: gapResolution,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          gapId: selectedNode.id,
          status: 'resolved',
          reason: gapResolution,
          idempotencyKey: buildIdempotencyKey('gap-resolve')
        },
        reset: () => setGapResolution('')
      } satisfies ActionConfig
    : null;

  const inquiryCloseAction = selectedNode?.kind === 'inquiry'
    ? {
        commandName: 'investigation.inquiry.close',
        title: t('action.closeInquiry'),
        rationale: inquiryResolutionReason,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          inquiryId: selectedNode.id,
          resolutionKind: 'answered',
          reason: inquiryResolutionReason,
          idempotencyKey: buildIdempotencyKey('inquiry-close')
        },
        reset: () => setInquiryResolutionReason('')
      } satisfies ActionConfig
    : null;

  const experimentResultAction = selectedNode?.kind === 'experiment'
    ? {
        commandName: 'investigation.experiment.record_result',
        title: t('action.recordExperimentResult'),
        rationale: experimentResultSummary,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          experimentId: selectedNode.id,
          status: 'completed',
          summary: experimentResultSummary,
          idempotencyKey: buildIdempotencyKey('experiment-result')
        },
        reset: () => setExperimentResultSummary('')
      } satisfies ActionConfig
    : null;

  const residualAcceptAction = selectedNode?.kind === 'residual'
    ? {
        commandName: 'investigation.residual.update',
        title: t('action.acceptResidualRisk'),
        rationale: residualRationale,
        requiresConfirm: true,
        targetIds: [selectedNode.id],
        payload: {
          caseId: props.caseId,
          ifCaseRevision: props.currentRevision,
          residualId: selectedNode.id,
          newStatus: 'accepted',
          rationale: residualRationale,
          idempotencyKey: buildIdempotencyKey('residual-accept')
        },
        reset: () => setResidualRationale('')
      } satisfies ActionConfig
    : null;

  return (
    <section className="panel panel-primary action-panel" data-testid="action-panel">
      <p className="panel-kicker">{t('action.kicker')}</p>
      <p className="snapshot-objective">
        {t('action.description')}
      </p>
      <label className="search-field">
        <span>{t('action.confirmRationale')}</span>
        <textarea
          data-testid="stage-rationale"
          disabled={props.historical || pending}
          onChange={(event) => setStageRationale(event.currentTarget.value)}
          placeholder={t('action.confirmPlaceholder')}
          rows={4}
          value={stageRationale}
        />
      </label>
      {props.historical ? <p className="history-banner">{t('action.historicalFrozen')}</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <button
        className="action-button"
        data-testid="action-advance-stage"
        disabled={props.historical
          || pending
          || (nextStage === 'closed'
            ? closureDecisionRationale.trim().length === 0 || !closeCasePass
            : stageRationale.trim().length === 0)}
        onClick={() => {
          if (nextStage === 'closed') {
            void executeCloseCaseFlow();
            return;
          }

          queueOrExecute(stageAction);
        }}
        type="button"
      >
        {stageActionTitle}
      </button>

      {props.caseStage === 'repair_validation' ? (
        <>
          <label className="search-field">
            <span>{t('action.closureRationale')}</span>
            <textarea
              data-testid="closure-decision-rationale"
              disabled={props.historical || pending}
              onChange={(event) => setClosureDecisionRationale(event.currentTarget.value)}
              placeholder={t('action.closurePlaceholder')}
              rows={3}
              value={closureDecisionRationale}
            />
          </label>
        </>
      ) : null}

      {selectedNode?.kind === 'hypothesis' ? (
        <>
          <label className="search-field">
            <span>{t('action.hypothesisRationale')}</span>
            <textarea
              data-testid="hypothesis-rationale"
              disabled={props.historical || pending}
              onChange={(event) => setHypothesisRationale(event.currentTarget.value)}
              placeholder={t('action.hypothesisPlaceholder')}
              rows={3}
              value={hypothesisRationale}
            />
          </label>
          <div className="confirm-actions">
            <button
              className="action-button"
              data-testid="action-confirm-hypothesis"
              disabled={props.historical || pending || hypothesisRationale.trim().length === 0}
              onClick={() => hypothesisConfirmAction && queueOrExecute(hypothesisConfirmAction)}
              type="button"
            >
              {t('action.confirmHypothesis')}
            </button>
            <button
              className="ghost-button"
              data-testid="action-open-gap"
              disabled={props.historical || pending || gapQuestion.trim().length === 0}
              onClick={() => hypothesisGapAction && queueOrExecute(hypothesisGapAction)}
              type="button"
            >
              {t('action.openGap')}
            </button>
            <button
              className="ghost-button"
              data-testid="action-record-decision"
              disabled={props.historical || pending || decisionRationale.trim().length === 0}
              onClick={() => hypothesisDecisionAction && queueOrExecute(hypothesisDecisionAction)}
              type="button"
            >
              {t('action.recordDecision')}
            </button>
            <button
              className="ghost-button"
              data-testid="action-plan-experiment"
              disabled={props.historical || pending || experimentObjective.trim().length === 0 || experimentExpectedOutcome.trim().length === 0 || !props.defaultInquiryId}
              onClick={() => hypothesisExperimentAction && queueOrExecute(hypothesisExperimentAction)}
              type="button"
            >
              {t('action.planExperiment')}
            </button>
          </div>
          <label className="search-field">
            <span>{t('action.gapQuestion')}</span>
            <textarea
              disabled={props.historical || pending}
              onChange={(event) => setGapQuestion(event.currentTarget.value)}
              placeholder={t('action.gapQuestionPlaceholder', { label: selectedNode.label })}
              rows={2}
              value={gapQuestion}
            />
          </label>
          <label className="search-field">
            <span>{t('action.decisionRationale')}</span>
            <textarea
              disabled={props.historical || pending}
              onChange={(event) => setDecisionRationale(event.currentTarget.value)}
              placeholder={t('action.decisionPlaceholder')}
              rows={2}
              value={decisionRationale}
            />
          </label>
          <label className="search-field">
            <span>{t('action.experimentObjective')}</span>
            <textarea
              data-testid="experiment-objective"
              disabled={props.historical || pending || !props.defaultInquiryId}
              onChange={(event) => setExperimentObjective(event.currentTarget.value)}
              placeholder={t('action.experimentObjectivePlaceholder')}
              rows={2}
              value={experimentObjective}
            />
          </label>
          <label className="search-field">
            <span>{t('action.expectedOutcome')}</span>
            <textarea
              data-testid="experiment-expected-outcome"
              disabled={props.historical || pending || !props.defaultInquiryId}
              onChange={(event) => setExperimentExpectedOutcome(event.currentTarget.value)}
              placeholder={t('action.expectedOutcomePlaceholder')}
              rows={2}
              value={experimentExpectedOutcome}
            />
          </label>
        </>
      ) : null}

      {selectedNode?.kind === 'symptom' ? (
        <>
          <label className="search-field">
            <span>{t('action.newHypothesis')}</span>
            <textarea
              data-testid="new-hypothesis-statement"
              disabled={props.historical || pending || !props.defaultInquiryId}
              onChange={(event) => setNewHypothesisStatement(event.currentTarget.value)}
              placeholder={t('action.newHypothesisPlaceholder', { label: selectedNode.label })}
              rows={3}
              value={newHypothesisStatement}
            />
          </label>
          <label className="search-field">
            <span>{t('action.falsificationCriteria')}</span>
            <textarea
              data-testid="new-hypothesis-falsification"
              disabled={props.historical || pending || !props.defaultInquiryId}
              onChange={(event) => setNewHypothesisFalsification(event.currentTarget.value)}
              placeholder={t('action.falsificationPlaceholder')}
              rows={2}
              value={newHypothesisFalsification}
            />
          </label>
          <div className="confirm-actions">
            <button
              className="action-button"
              data-testid="action-propose-hypothesis"
              disabled={props.historical || pending || newHypothesisStatement.trim().length === 0 || newHypothesisFalsification.trim().length === 0 || !props.defaultInquiryId}
              onClick={() => symptomHypothesisAction && queueOrExecute(symptomHypothesisAction)}
              type="button"
            >
              {t('action.proposeHypothesis')}
            </button>
            <button
              className="ghost-button"
              data-testid="action-open-residual"
              disabled={props.historical || pending || residualStatement.trim().length === 0}
              onClick={() => symptomResidualAction && queueOrExecute(symptomResidualAction)}
              type="button"
            >
              {t('action.openResidual')}
            </button>
          </div>
          <label className="search-field">
            <span>{t('action.residualStatement')}</span>
            <textarea
              data-testid="residual-statement"
              disabled={props.historical || pending}
              onChange={(event) => setResidualStatement(event.currentTarget.value)}
              placeholder={t('action.residualStatementPlaceholder', { label: selectedNode.label })}
              rows={2}
              value={residualStatement}
            />
          </label>
        </>
      ) : null}

      {selectedNode?.kind === 'experiment' ? (
        <>
          <label className="search-field">
            <span>{t('action.experimentResult')}</span>
            <textarea
              data-testid="experiment-result-summary"
              disabled={props.historical || pending}
              onChange={(event) => setExperimentResultSummary(event.currentTarget.value)}
              placeholder={t('action.experimentResultPlaceholder')}
              rows={3}
              value={experimentResultSummary}
            />
          </label>
          <button
            className="action-button"
            data-testid="action-record-experiment-result"
            disabled={props.historical || pending || experimentResultSummary.trim().length === 0}
            onClick={() => experimentResultAction && queueOrExecute(experimentResultAction)}
            type="button"
          >
            {t('action.recordExperimentResult')}
          </button>
        </>
      ) : null}

      {selectedNode?.kind === 'inquiry' ? (
        <>
          <label className="search-field">
            <span>{t('action.inquiryResolution')}</span>
            <textarea
              data-testid="inquiry-resolution-reason"
              disabled={props.historical || pending}
              onChange={(event) => setInquiryResolutionReason(event.currentTarget.value)}
              placeholder={t('action.inquiryResolutionPlaceholder')}
              rows={3}
              value={inquiryResolutionReason}
            />
          </label>
          <button
            className="ghost-button"
            data-testid="action-close-inquiry"
            disabled={props.historical || pending || inquiryResolutionReason.trim().length === 0}
            onClick={() => inquiryCloseAction && queueOrExecute(inquiryCloseAction)}
            type="button"
          >
            {t('action.closeInquiry')}
          </button>
        </>
      ) : null}

      {selectedNode?.kind === 'gap' ? (
        <>
          <label className="search-field">
            <span>{t('action.gapResolution')}</span>
            <textarea
              data-testid="gap-resolution-rationale"
              disabled={props.historical || pending}
              onChange={(event) => setGapResolution(event.currentTarget.value)}
              placeholder={t('action.gapResolutionPlaceholder')}
              rows={3}
              value={gapResolution}
            />
          </label>
          <button
            className="action-button"
            data-testid="action-resolve-gap"
            disabled={props.historical || pending || gapResolution.trim().length === 0}
            onClick={() => gapResolveAction && queueOrExecute(gapResolveAction)}
            type="button"
          >
            {t('action.resolveGap')}
          </button>
        </>
      ) : null}

      {selectedNode?.kind === 'residual' ? (
        <>
          <label className="search-field">
            <span>{t('action.residualRationale')}</span>
            <textarea
              data-testid="residual-rationale"
              disabled={props.historical || pending}
              onChange={(event) => setResidualRationale(event.currentTarget.value)}
              placeholder={t('action.residualPlaceholder')}
              rows={3}
              value={residualRationale}
            />
          </label>
          <button
            className="ghost-button"
            data-testid="action-accept-residual"
            disabled={props.historical || pending || residualRationale.trim().length === 0}
            onClick={() => residualAcceptAction && queueOrExecute(residualAcceptAction)}
            type="button"
          >
            {t('action.acceptResidual')}
          </button>
        </>
      ) : null}

      {confirmAction ? (
        <div className="confirm-sheet" data-testid="confirm-dialog">
          <p className="panel-kicker">{t('action.confirmSheet')}</p>
          <h4>{confirmAction.title}</h4>
          <p>{confirmAction.rationale}</p>
          <div className="confirm-actions">
            <button className="ghost-button" onClick={() => setConfirmAction(null)} type="button">
              {t('action.cancel')}
            </button>
            <button data-testid="confirm-submit" onClick={() => void submitConfirmedAction()} type="button">
              {pending ? t('action.submitting') : t('action.issueConfirmation')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
