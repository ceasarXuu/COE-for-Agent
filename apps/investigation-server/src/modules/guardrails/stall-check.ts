import type { InvestigationServerServices } from '../../services.js';
import { recordPayload, stringValue } from '../shared/record-helpers.js';
import { isCanonicalHypothesisRecord, loadCaseGuardrailContext, nodeStatus } from './shared.js';

interface StallSignal {
  code: string;
  severity: 'medium' | 'high' | 'critical';
  message: string;
}

function calculateRisk(signals: StallSignal[]): 'low' | 'medium' | 'high' {
  const criticalCount = signals.filter((signal) => signal.severity === 'critical').length;
  const highCount = signals.filter((signal) => signal.severity === 'high').length;
  const mediumCount = signals.filter((signal) => signal.severity === 'medium').length;

  if (criticalCount >= 1 || highCount >= 2) {
    return 'high';
  }

  if (highCount >= 1 || mediumCount >= 2) {
    return 'medium';
  }

  return 'low';
}

export async function handleGuardrailStallCheck(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const caseId = typeof input.caseId === 'string' ? input.caseId : '';
  const context = await loadCaseGuardrailContext(services, caseId, { includeEvents: true });
  const recentEvents = context.events.slice(-20);
  const signals: StallSignal[] = [];
  const activeHypothesisCount = context.mode === 'canonical'
    ? context.hypotheses
        .filter(isCanonicalHypothesisRecord)
        .filter((record) => nodeStatus(record, 'unverified') !== 'rejected')
        .length
    : context.hypotheses.filter((record) => nodeStatus(record, 'proposed') !== 'rejected').length;

  if (activeHypothesisCount > 3) {
    signals.push({
      code: 'active_hypothesis_count_gt_3',
      severity: 'high',
      message: 'Too many active hypotheses are competing without being narrowed down.'
    });
  }

  const recentFactWindow = recentEvents.slice(-5);
  const factLikeEventTypes = context.mode === 'canonical'
    ? ['canonical.evidence.captured', 'canonical.evidence.attached']
    : ['fact.asserted'];
  if (recentFactWindow.length === 5 && !recentFactWindow.some((event) => factLikeEventTypes.includes(event.eventType))) {
    signals.push({
      code: context.mode === 'canonical' ? 'no_new_evidence_in_last_5_events' : 'no_new_fact_in_last_5_events',
      severity: 'medium',
      message: context.mode === 'canonical'
        ? 'The latest five write events did not add any new canonical evidence.'
        : 'The latest five write events did not add any new facts.'
    });
  }

  const recentStatusWindow = recentEvents.slice(-6);
  const hypothesisStatusEventTypes = context.mode === 'canonical'
    ? ['canonical.hypothesis.status_updated']
    : ['hypothesis.status_updated'];
  if (recentStatusWindow.length === 6 && !recentStatusWindow.some((event) => hypothesisStatusEventTypes.includes(event.eventType))) {
    signals.push({
      code: 'no_hypothesis_status_change_in_last_6_events',
      severity: 'medium',
      message: 'Hypotheses have not been narrowed or promoted in the latest six write events.'
    });
  }

  const completedExperiments = context.experiments.filter((record) => nodeStatus(record, 'planned') === 'completed');
  if (context.mode !== 'canonical' && context.hypotheses.length > 0 && completedExperiments.length === 0) {
    signals.push({
      code: 'no_discriminative_experiment_completed',
      severity: 'high',
      message: 'No completed experiment has discriminated among the active hypotheses yet.'
    });
  }

  if (context.mode !== 'canonical') {
    const recentInquiryIds = recentEvents
      .slice(-4)
      .map((event) => {
        const payload = recordPayload({ payload: event.payload });
        return stringValue(payload.inquiryId) ?? stringValue(payload.defaultInquiryId) ?? null;
      });
    if (recentInquiryIds.length === 4 && recentInquiryIds.every((value) => value !== null && value === recentInquiryIds[0])) {
      signals.push({
        code: 'same_inquiry_revisited_4_times',
        severity: 'high',
        message: 'The latest four write events all revisited the same inquiry without branching.'
      });
    }
  }

  const risk = calculateRisk(signals);

  return {
    kind: 'investigation.guardrail.stall_check_result',
    risk,
    signals,
    recommendedActions: signals.map((signal) => {
      if (signal.code === 'active_hypothesis_count_gt_3') {
        return 'Narrow the field by favoring, rejecting, or merging competing hypotheses.';
      }

      if (signal.code === 'no_discriminative_experiment_completed') {
        return 'Plan and complete a discriminative experiment to separate the leading hypotheses.';
      }

      return 'Capture a new fact or decision to move the investigation forward.';
    })
  };
}
