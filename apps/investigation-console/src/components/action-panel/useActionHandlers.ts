import { useCallback } from 'react';

import { buildIdempotencyKey } from '@coe/shared-utils';

import type { GraphNodeRecord, GuardrailBundle } from '../../lib/api.js';
import { invokeTool, requestConfirmIntent } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.js';

import type { ActionConfig } from './types.js';

interface UseActionHandlersOptions {
  caseId: string;
  caseStage?: string | null;
  defaultInquiryId?: string | null;
  currentRevision: number;
  guardrails?: GuardrailBundle | null;
  selectedNode?: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'> | null;
  onMutationComplete: () => Promise<void> | void;
  setConfirmAction: (action: ActionConfig | null) => void;
  setPending: (pending: boolean) => void;
  setError: (error: string | null) => void;
  setStageRationale: (value: string) => void;
  setHypothesisRationale: (value: string) => void;
  setNewHypothesisStatement: (value: string) => void;
  setNewHypothesisFalsification: (value: string) => void;
  setExperimentObjective: (value: string) => void;
  setExperimentExpectedOutcome: (value: string) => void;
  setExperimentResultSummary: (value: string) => void;
  setGapQuestion: (value: string) => void;
  setGapResolution: (value: string) => void;
  setInquiryResolutionReason: (value: string) => void;
  setResidualStatement: (value: string) => void;
  setResidualRationale: (value: string) => void;
  setDecisionRationale: (value: string) => void;
  setClosureDecisionRationale: (value: string) => void;
  stageRationale: string;
  hypothesisRationale: string;
  newHypothesisStatement: string;
  newHypothesisFalsification: string;
  experimentObjective: string;
  experimentExpectedOutcome: string;
  experimentResultSummary: string;
  gapQuestion: string;
  gapResolution: string;
  inquiryResolutionReason: string;
  residualStatement: string;
  residualRationale: string;
  decisionRationale: string;
  closureDecisionRationale: string;
  confirmAction: ActionConfig | null;
}

export function useActionHandlers(options: UseActionHandlersOptions) {
  const { t } = useI18n();

  const executeAction = useCallback(
    async (action: ActionConfig, confirmToken?: string) => {
      options.setPending(true);
      options.setError(null);

      try {
        await invokeTool(action.commandName, {
          ...action.payload,
          ...(confirmToken ? { confirmToken } : {})
        });

        options.setConfirmAction(null);
        action.reset();
        await options.onMutationComplete();
      } catch (reason: unknown) {
        options.setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
      } finally {
        options.setPending(false);
      }
    },
    [options, t]
  );

  const submitConfirmedAction = useCallback(async () => {
    if (!options.confirmAction) {
      return;
    }

    options.setPending(true);
    options.setError(null);

    try {
      const confirmation = await requestConfirmIntent({
        commandName: options.confirmAction.commandName,
        caseId: options.caseId,
        targetIds: options.confirmAction.targetIds,
        rationale: options.confirmAction.rationale
      });

      await executeAction(options.confirmAction, confirmation.confirmToken);
    } catch (reason: unknown) {
      options.setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
      options.setPending(false);
    }
  }, [options, executeAction, t]);

  const executeCloseCaseFlow = useCallback(async () => {
    if (options.caseStage !== 'repair_validation') {
      return;
    }

    const rationale = options.closureDecisionRationale.trim();
    if (rationale.length === 0) {
      return;
    }

    options.setPending(true);
    options.setError(null);

    try {
      const closeDecisionConfirmation = await requestConfirmIntent({
        commandName: 'investigation.decision.record',
        caseId: options.caseId,
        targetIds: [options.caseId],
        rationale
      });

      const closeDecisionResult = await invokeTool<{ headRevisionAfter: number }>('investigation.decision.record', {
        caseId: options.caseId,
        ifCaseRevision: options.currentRevision,
        title: t('action.closeReady'),
        decisionKind: 'close_case',
        statement: rationale,
        rationale,
        idempotencyKey: buildIdempotencyKey('decision-close-case'),
        confirmToken: closeDecisionConfirmation.confirmToken
      });

      const closeCaseConfirmation = await requestConfirmIntent({
        commandName: 'investigation.case.advance_stage',
        caseId: options.caseId,
        targetIds: [options.caseId],
        rationale
      });

      await invokeTool('investigation.case.advance_stage', {
        caseId: options.caseId,
        ifCaseRevision: closeDecisionResult.headRevisionAfter,
        stage: 'closed',
        reason: rationale,
        idempotencyKey: buildIdempotencyKey('case-close'),
        confirmToken: closeCaseConfirmation.confirmToken
      });

      options.setClosureDecisionRationale('');
      await options.onMutationComplete();
    } catch (reason: unknown) {
      options.setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      options.setPending(false);
    }
  }, [options, t]);

  const queueOrExecute = useCallback(
    (action: ActionConfig) => {
      if (action.requiresConfirm) {
        options.setConfirmAction(action);
        return;
      }

      void executeAction(action);
    },
    [options, executeAction]
  );

  const closeCasePass = options.guardrails?.closeCase.pass === true;
  const nextStage = options.caseStage === 'repair_preparation'
    ? 'repair_validation'
    : options.caseStage === 'repair_validation'
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
    rationale: options.stageRationale,
    requiresConfirm: true,
    targetIds: [options.caseId],
    payload: {
      caseId: options.caseId,
      ifCaseRevision: options.currentRevision,
      stage: nextStage,
      reason: options.stageRationale,
      idempotencyKey: buildIdempotencyKey(`case-stage-${nextStage}`)
    },
    reset: () => options.setStageRationale('')
  };

  const selectedNode = options.selectedNode ?? null;
  const readyToPatchPass = options.guardrails?.readyToPatch.pass === true;

  const hypothesisConfirmAction = selectedNode?.kind === 'hypothesis'
    ? {
        commandName: 'investigation.hypothesis.update_status',
        title: t('action.confirmHypothesis'),
        rationale: options.hypothesisRationale,
        requiresConfirm: true,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          hypothesisId: selectedNode.id,
          newStatus: 'confirmed',
          reason: options.hypothesisRationale,
          idempotencyKey: buildIdempotencyKey('hypothesis-confirm')
        },
        reset: () => options.setHypothesisRationale('')
      } satisfies ActionConfig
    : null;

  const symptomHypothesisAction = selectedNode?.kind === 'symptom' && options.defaultInquiryId
    ? {
        commandName: 'investigation.hypothesis.propose',
        title: t('action.proposeHypothesis'),
        rationale: options.newHypothesisStatement,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          inquiryId: options.defaultInquiryId,
          title: t('action.generatedHypothesisTitle', { label: selectedNode.label }),
          statement: options.newHypothesisStatement,
          level: 'mechanism',
          explainsSymptomIds: [selectedNode.id],
          dependsOnFactIds: [],
          falsificationCriteria: [options.newHypothesisFalsification],
          idempotencyKey: buildIdempotencyKey('hypothesis-propose')
        },
        reset: () => {
          options.setNewHypothesisStatement('');
          options.setNewHypothesisFalsification('');
        }
      } satisfies ActionConfig
    : null;

  const symptomResidualAction = selectedNode?.kind === 'symptom'
    ? {
        commandName: 'investigation.issue.record',
        title: t('action.openResidual'),
        rationale: options.residualStatement,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          issueKind: 'unresolved',
          title: t('action.generatedResidualTitle', { label: selectedNode.label }),
          summary: options.residualStatement,
          priority: 'high',
          blocking: false,
          relatedSymptomIds: [selectedNode.id],
          idempotencyKey: buildIdempotencyKey('issue-record')
        },
        reset: () => options.setResidualStatement('')
      } satisfies ActionConfig
    : null;

  const hypothesisGapAction = selectedNode?.kind === 'hypothesis'
    ? {
        commandName: 'investigation.issue.record',
        title: t('action.openInvestigationGap'),
        rationale: options.gapQuestion,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          issueKind: 'unresolved',
          title: t('action.generatedGapTitle', { label: selectedNode.label }),
          summary: options.gapQuestion,
          priority: 'high',
          blocking: true,
          blockedRefs: [selectedNode.id],
          idempotencyKey: buildIdempotencyKey('issue-record')
        },
        reset: () => options.setGapQuestion('')
      } satisfies ActionConfig
    : null;

  const hypothesisExperimentAction = selectedNode?.kind === 'hypothesis' && options.defaultInquiryId
    ? {
        commandName: 'investigation.experiment.plan',
        title: t('action.planExperiment'),
        rationale: options.experimentObjective,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          inquiryId: options.defaultInquiryId,
          title: t('action.generatedExperimentTitle', { label: selectedNode.label }),
          objective: options.experimentObjective,
          method: 'patch_probe',
          testsHypothesisIds: [selectedNode.id],
          expectedOutcomes: [
            {
              when: t('action.experimentWhen'),
              expect: options.experimentExpectedOutcome
            }
          ],
          idempotencyKey: buildIdempotencyKey('experiment-plan')
        },
        reset: () => {
          options.setExperimentObjective('');
          options.setExperimentExpectedOutcome('');
        }
      } satisfies ActionConfig
    : null;

  const hypothesisDecisionAction = selectedNode?.kind === 'hypothesis'
    ? {
        commandName: 'investigation.decision.record',
        title: t('action.recordReadiness'),
        rationale: options.decisionRationale,
        requiresConfirm: readyToPatchPass,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          title: readyToPatchPass ? t('action.readinessReady') : t('action.readinessBranch'),
          decisionKind: readyToPatchPass ? 'ready_to_patch' : 'deprioritize_branch',
          statement: options.decisionRationale,
          supportingHypothesisIds: [selectedNode.id],
          rationale: options.decisionRationale,
          idempotencyKey: buildIdempotencyKey('decision-record')
        },
        reset: () => options.setDecisionRationale('')
      } satisfies ActionConfig
    : null;

  const gapResolveAction = selectedNode?.kind === 'gap'
    ? {
        commandName: 'investigation.issue.resolve',
        title: t('action.resolveGap'),
        rationale: options.gapResolution,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          issueId: selectedNode.id,
          resolution: 'resolved',
          rationale: options.gapResolution,
          idempotencyKey: buildIdempotencyKey('issue-resolve')
        },
        reset: () => options.setGapResolution('')
      } satisfies ActionConfig
    : null;

  const inquiryCloseAction = selectedNode?.kind === 'inquiry'
    ? {
        commandName: 'investigation.issue.resolve',
        title: t('action.closeInquiry'),
        rationale: options.inquiryResolutionReason,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          issueId: selectedNode.id,
          resolution: 'answered',
          rationale: options.inquiryResolutionReason,
          idempotencyKey: buildIdempotencyKey('issue-resolve')
        },
        reset: () => options.setInquiryResolutionReason('')
      } satisfies ActionConfig
    : null;

  const experimentResultAction = selectedNode?.kind === 'experiment'
    ? {
        commandName: 'investigation.experiment.record_result',
        title: t('action.recordExperimentResult'),
        rationale: options.experimentResultSummary,
        requiresConfirm: false,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          experimentId: selectedNode.id,
          status: 'completed',
          summary: options.experimentResultSummary,
          idempotencyKey: buildIdempotencyKey('experiment-result')
        },
        reset: () => options.setExperimentResultSummary('')
      } satisfies ActionConfig
    : null;

  const residualAcceptAction = selectedNode?.kind === 'residual'
    ? {
        commandName: 'investigation.issue.resolve',
        title: t('action.acceptResidualRisk'),
        rationale: options.residualRationale,
        requiresConfirm: true,
        targetIds: [selectedNode.id],
        payload: {
          caseId: options.caseId,
          ifCaseRevision: options.currentRevision,
          issueId: selectedNode.id,
          resolution: 'accepted',
          rationale: options.residualRationale,
          idempotencyKey: buildIdempotencyKey('issue-resolve')
        },
        reset: () => options.setResidualRationale('')
      } satisfies ActionConfig
    : null;

  return {
    executeAction,
    submitConfirmedAction,
    executeCloseCaseFlow,
    queueOrExecute,
    closeCasePass,
    nextStage,
    stageActionTitle,
    stageAction,
    selectedNode,
    readyToPatchPass,
    hypothesisConfirmAction,
    symptomHypothesisAction,
    symptomResidualAction,
    hypothesisGapAction,
    hypothesisExperimentAction,
    hypothesisDecisionAction,
    gapResolveAction,
    inquiryCloseAction,
    experimentResultAction,
    residualAcceptAction
  };
}
