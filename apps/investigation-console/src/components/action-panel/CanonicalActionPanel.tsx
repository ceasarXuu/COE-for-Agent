import { useEffect, useMemo, useRef, useState } from 'react';

import { invokeTool, requestConfirmIntent, type GraphNodeRecord } from '../../lib/api.js';
import { useI18n } from '../../lib/i18n.js';

interface CanonicalActionPanelProps {
  caseId: string;
  currentRevision: number;
  historical: boolean;
  onMutationComplete: () => Promise<void> | void;
  selectedNode?: GraphNodeRecord | null;
}

export function CanonicalActionPanel(props: CanonicalActionPanelProps) {
  const { formatEnumLabel, t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [problemTitle, setProblemTitle] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [problemEnvironment, setProblemEnvironment] = useState('');
  const [problemSymptoms, setProblemSymptoms] = useState('');
  const [problemResolutionCriteria, setProblemResolutionCriteria] = useState('');
  const localRevisionRef = useRef(props.currentRevision);
  const lastSavedProblemRef = useRef<string>('');

  useEffect(() => {
    localRevisionRef.current = props.currentRevision;
  }, [props.currentRevision]);

  useEffect(() => {
    if (props.selectedNode?.kind !== 'problem') {
      return;
    }

    const payload = props.selectedNode.payload ?? {};
    const nextTitle = typeof payload.title === 'string' ? payload.title : props.selectedNode.label;
    const nextDescription = typeof payload.description === 'string' ? payload.description : '';
    const nextEnvironment = typeof payload.environment === 'string' ? payload.environment : '';
    const nextSymptoms = Array.isArray(payload.symptoms) ? payload.symptoms.join('\n') : '';
    const nextResolutionCriteria = Array.isArray(payload.resolutionCriteria) ? payload.resolutionCriteria.join('\n') : '';

    setProblemTitle(nextTitle);
    setProblemDescription(nextDescription);
    setProblemEnvironment(nextEnvironment);
    setProblemSymptoms(nextSymptoms);
    setProblemResolutionCriteria(nextResolutionCriteria);
    lastSavedProblemRef.current = JSON.stringify({
      title: nextTitle,
      description: nextDescription,
      environment: nextEnvironment,
      symptoms: nextSymptoms,
      resolutionCriteria: nextResolutionCriteria
    });
  }, [props.selectedNode?.id, props.selectedNode?.kind, props.selectedNode?.label, props.selectedNode?.payload]);

  useEffect(() => {
    if (props.historical || props.selectedNode?.kind !== 'problem') {
      return;
    }

    const nextDraft = JSON.stringify({
      title: problemTitle,
      description: problemDescription,
      environment: problemEnvironment,
      symptoms: problemSymptoms,
      resolutionCriteria: problemResolutionCriteria
    });

    if (nextDraft === lastSavedProblemRef.current) {
      return;
    }

    const handle = window.setTimeout(() => {
      void saveProblemDraft();
    }, 600);

    return () => {
      window.clearTimeout(handle);
    };
  }, [
    problemTitle,
    problemDescription,
    problemEnvironment,
    problemSymptoms,
    problemResolutionCriteria,
    props.historical,
    props.selectedNode?.id,
    props.selectedNode?.kind
  ]);

  const canonicalProblemFields = useMemo(() => {
    return {
      title: problemTitle.trim(),
      description: problemDescription.trim(),
      environment: problemEnvironment.trim(),
      symptoms: splitLines(problemSymptoms),
      resolutionCriteria: splitLines(problemResolutionCriteria)
    };
  }, [problemTitle, problemDescription, problemEnvironment, problemSymptoms, problemResolutionCriteria]);

  async function saveProblemDraft() {
    if (props.selectedNode?.kind !== 'problem' || props.historical) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        caseId: props.caseId,
        ifCaseRevision: localRevisionRef.current,
        problemId: props.selectedNode.id,
        idempotencyKey: `problem-update-${props.selectedNode.id}-${Date.now()}`
      };

      if (canonicalProblemFields.title.length > 0) {
        payload.title = canonicalProblemFields.title;
      }
      if (canonicalProblemFields.description.length > 0) {
        payload.description = canonicalProblemFields.description;
      }
      if (canonicalProblemFields.environment.length > 0) {
        payload.environment = canonicalProblemFields.environment;
      }
      if (canonicalProblemFields.symptoms.length > 0) {
        payload.symptoms = canonicalProblemFields.symptoms;
      }
      if (canonicalProblemFields.resolutionCriteria.length > 0) {
        payload.resolutionCriteria = canonicalProblemFields.resolutionCriteria;
      }

      const result = await invokeTool<{ headRevisionAfter: number }>('investigation.problem.update', payload);
      localRevisionRef.current = result.headRevisionAfter;
      lastSavedProblemRef.current = JSON.stringify({
        title: problemTitle,
        description: problemDescription,
        environment: problemEnvironment,
        symptoms: problemSymptoms,
        resolutionCriteria: problemResolutionCriteria
      });
      await props.onMutationComplete();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      setPending(false);
    }
  }

  async function updateNodeStatus(commandName: string, payload: Record<string, unknown>, requiresConfirm = false) {
    if (props.historical || !props.selectedNode) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      let confirmToken: string | undefined;
      if (requiresConfirm) {
        const confirmation = await requestConfirmIntent({
          commandName,
          caseId: props.caseId,
          targetIds: [props.selectedNode.id],
          rationale: statusReason
        });
        confirmToken = confirmation.confirmToken;
      }

      const result = await invokeTool<{ headRevisionAfter: number }>(commandName, {
        ...payload,
        ...(typeof payload.idempotencyKey === 'string' ? {} : { idempotencyKey: `${commandName}-${props.selectedNode.id}-${Date.now()}` }),
        ...(confirmToken ? { confirmToken } : {})
      });
      localRevisionRef.current = result.headRevisionAfter;
      setStatusReason('');
      await props.onMutationComplete();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('errors.mutationFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel panel-primary action-panel" data-testid="action-panel">
      <p className="panel-kicker">{t('action.kicker')}</p>
      {props.historical ? <p className="history-banner">{t('action.historicalFrozen')}</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}

      {props.selectedNode?.kind === 'problem' ? (
        <>
          <label className="search-field">
            <span>{t('graph.node.problem')}</span>
            <textarea
              data-testid="canonical-problem-description"
              disabled={props.historical || pending}
              onChange={(event) => setProblemDescription(event.currentTarget.value)}
              rows={4}
              value={problemDescription}
            />
          </label>
          <label className="search-field">
            <span>Environment</span>
            <textarea
              data-testid="canonical-problem-environment"
              disabled={props.historical || pending}
              onChange={(event) => setProblemEnvironment(event.currentTarget.value)}
              rows={3}
              value={problemEnvironment}
            />
          </label>
          <label className="search-field">
            <span>Symptoms</span>
            <textarea
              data-testid="canonical-problem-symptoms"
              disabled={props.historical || pending}
              onChange={(event) => setProblemSymptoms(event.currentTarget.value)}
              rows={3}
              value={problemSymptoms}
            />
          </label>
          <label className="search-field">
            <span>Resolution Criteria</span>
            <textarea
              data-testid="canonical-problem-resolution-criteria"
              disabled={props.historical || pending}
              onChange={(event) => setProblemResolutionCriteria(event.currentTarget.value)}
              rows={3}
              value={problemResolutionCriteria}
            />
          </label>
          <div className="confirm-actions">
            <button
              className="action-button"
              data-testid="action-problem-resolved"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.problem.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  problemId: props.selectedNode?.id,
                  newStatus: 'resolved',
                  reason: statusReason
                })
              }
              type="button"
            >
              Resolve Problem
            </button>
            <button
              className="ghost-button"
              data-testid="action-problem-abandoned"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.problem.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  problemId: props.selectedNode?.id,
                  newStatus: 'abandoned',
                  reason: statusReason
                })
              }
              type="button"
            >
              Abandon Problem
            </button>
          </div>
        </>
      ) : null}

      {props.selectedNode?.kind === 'hypothesis' ? (
        <>
          <label className="search-field">
            <span>Transition rationale</span>
            <textarea
              data-testid="canonical-status-reason"
              disabled={props.historical || pending}
              onChange={(event) => setStatusReason(event.currentTarget.value)}
              rows={3}
              value={statusReason}
            />
          </label>
          <div className="confirm-actions">
            <button
              className="action-button"
              data-testid="action-canonical-hypothesis-confirm"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus(
                  'investigation.hypothesis.set_status',
                  {
                    caseId: props.caseId,
                    ifCaseRevision: localRevisionRef.current,
                    hypothesisId: props.selectedNode?.id,
                    newStatus: 'confirmed',
                    reason: statusReason
                  },
                  true
                )
              }
              type="button"
            >
              Confirm Hypothesis
            </button>
            <button
              className="ghost-button"
              data-testid="action-canonical-hypothesis-block"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.hypothesis.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  hypothesisId: props.selectedNode?.id,
                  newStatus: 'blocked',
                  reason: statusReason
                })
              }
              type="button"
            >
              Block Hypothesis
            </button>
            <button
              className="ghost-button"
              data-testid="action-canonical-hypothesis-reject"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.hypothesis.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  hypothesisId: props.selectedNode?.id,
                  newStatus: 'rejected',
                  reason: statusReason
                })
              }
              type="button"
            >
              Reject Hypothesis
            </button>
          </div>
        </>
      ) : null}

      {props.selectedNode?.kind === 'blocker' ? (
        <>
          <label className="search-field">
            <span>Close rationale</span>
            <textarea
              data-testid="canonical-status-reason"
              disabled={props.historical || pending}
              onChange={(event) => setStatusReason(event.currentTarget.value)}
              rows={3}
              value={statusReason}
            />
          </label>
          <button
            className="action-button"
            data-testid="action-canonical-blocker-close"
            disabled={props.historical || pending || statusReason.trim().length === 0}
            onClick={() =>
              void updateNodeStatus('investigation.blocker.close', {
                caseId: props.caseId,
                ifCaseRevision: localRevisionRef.current,
                blockerId: props.selectedNode?.id,
                reason: statusReason
              })
            }
            type="button"
          >
            Close Blocker
          </button>
        </>
      ) : null}

      {props.selectedNode?.kind === 'repair_attempt' ? (
        <>
          <label className="search-field">
            <span>Transition rationale</span>
            <textarea
              data-testid="canonical-status-reason"
              disabled={props.historical || pending}
              onChange={(event) => setStatusReason(event.currentTarget.value)}
              rows={3}
              value={statusReason}
            />
          </label>
          <div className="confirm-actions">
            <button
              className="action-button"
              data-testid="action-canonical-repair-running"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.repair_attempt.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  repairAttemptId: props.selectedNode?.id,
                  newStatus: 'running',
                  reason: statusReason
                })
              }
              type="button"
            >
              Start Repair Attempt
            </button>
            <button
              className="ghost-button"
              data-testid="action-canonical-repair-effective"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.repair_attempt.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  repairAttemptId: props.selectedNode?.id,
                  newStatus: 'effective',
                  reason: statusReason
                })
              }
              type="button"
            >
              Mark Effective
            </button>
            <button
              className="ghost-button"
              data-testid="action-canonical-repair-ineffective"
              disabled={props.historical || pending || statusReason.trim().length === 0}
              onClick={() =>
                void updateNodeStatus('investigation.repair_attempt.set_status', {
                  caseId: props.caseId,
                  ifCaseRevision: localRevisionRef.current,
                  repairAttemptId: props.selectedNode?.id,
                  newStatus: 'ineffective',
                  reason: statusReason
                })
              }
              type="button"
            >
              Mark Ineffective
            </button>
          </div>
        </>
      ) : null}

      {props.selectedNode?.kind === 'evidence_ref' ? (
        <p>{props.selectedNode.summary ?? 'Evidence is attached to this branch.'}</p>
      ) : null}

      {!props.selectedNode ? <p>{t('inspector.empty')}</p> : null}
      {props.selectedNode ? (
        <p className="inspector-status">{formatEnumLabel(props.selectedNode.status ?? 'stateless')}</p>
      ) : null}
    </section>
  );
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
