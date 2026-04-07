import { useState } from 'react';

import { buildIdempotencyKey } from '@coe/shared-utils';

import type { GraphNodeRecord, GuardrailBundle } from '../lib/api.js';
import { invokeTool, requestConfirmIntent } from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';

interface ActionConfig {
  commandName:
    | 'investigation.case.advance_stage'
    | 'investigation.hypothesis.update_status'
    | 'investigation.gap.open'
    | 'investigation.gap.resolve'
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
  currentRevision: number;
  historical: boolean;
  selectedNode?: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'> | null;
  guardrails?: GuardrailBundle | null;
  onMutationComplete: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const [stageRationale, setStageRationale] = useState('');
  const [hypothesisRationale, setHypothesisRationale] = useState('');
  const [gapQuestion, setGapQuestion] = useState('');
  const [gapResolution, setGapResolution] = useState('');
  const [residualRationale, setResidualRationale] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
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

  function queueOrExecute(action: ActionConfig) {
    if (action.requiresConfirm) {
      setConfirmAction(action);
      return;
    }

    void executeAction(action);
  }

  const stageAction: ActionConfig = {
    commandName: 'investigation.case.advance_stage',
    title: t('action.advance'),
    rationale: stageRationale,
    requiresConfirm: true,
    targetIds: [props.caseId],
    payload: {
      caseId: props.caseId,
      ifCaseRevision: props.currentRevision,
      stage: 'repair_preparation',
      reason: stageRationale
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
    <section className="panel action-panel">
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
        disabled={props.historical || pending || stageRationale.trim().length === 0}
        onClick={() => queueOrExecute(stageAction)}
        type="button"
      >
        {t('action.advance')}
      </button>

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