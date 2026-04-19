import type { InvestigationServerServices } from '../../services.js';
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
  const activeHypothesisCount = context.hypotheses
    .filter(isCanonicalHypothesisRecord)
    .filter((record) => nodeStatus(record, 'unverified') !== 'rejected')
    .length;

  if (activeHypothesisCount > 3) {
    signals.push({
      code: 'active_hypothesis_count_gt_3',
      severity: 'high',
      message: 'Too many active hypotheses are competing without being narrowed down.'
    });
  }

  const recentEvidenceWindow = recentEvents.slice(-5);
  if (
    recentEvidenceWindow.length === 5 &&
    !recentEvidenceWindow.some((event) => event.eventType === 'canonical.evidence.captured' || event.eventType === 'canonical.evidence.attached')
  ) {
    signals.push({
      code: 'no_new_evidence_in_last_5_events',
      severity: 'medium',
      message: 'The latest five write events did not add any new canonical evidence.'
    });
  }

  const recentStatusWindow = recentEvents.slice(-6);
  if (recentStatusWindow.length === 6 && !recentStatusWindow.some((event) => event.eventType === 'canonical.hypothesis.status_updated')) {
    signals.push({
      code: 'no_hypothesis_status_change_in_last_6_events',
      severity: 'medium',
      message: 'Hypotheses have not been narrowed or promoted in the latest six write events.'
    });
  }

  const risk = calculateRisk(signals);

  return {
    kind: 'investigation.guardrail.stall_check_result',
    risk,
    signals,
    recommendedActions: signals.map((signal) => {
      if (signal.code === 'active_hypothesis_count_gt_3') {
        return 'Narrow the field by confirming, rejecting, or blocking competing hypotheses.';
      }

      return 'Capture a new evidence node or close a blocker to move the investigation forward.';
    })
  };
}
