import { createCommandResult } from '@coe/domain';

import type { InvestigationServerServices } from '../../services.js';
import { handleEvidenceAttachExisting } from './evidence-attach-existing.js';
import { handleEvidenceCapture } from './evidence-capture.js';

interface CaptureAndAttachResult {
  createdIds?: string[];
  eventId?: string;
  headRevisionAfter: number;
}

export async function handleEvidenceCaptureAndAttach(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const captured = await handleEvidenceCapture(services, input) as CaptureAndAttachResult;
  const evidenceId = captured.createdIds?.find((value) => value.startsWith('evidence_'));
  if (!evidenceId) {
    throw new Error('evidence.capture did not return an evidence id');
  }

  const attached = await handleEvidenceAttachExisting(services, {
    ...input,
    ifCaseRevision: captured.headRevisionAfter,
    evidenceId
  }) as CaptureAndAttachResult;
  const eventId = attached.eventId ?? captured.eventId;
  if (!eventId) {
    throw new Error('evidence.capture_and_attach did not produce an event id');
  }

  return createCommandResult({
    ok: true,
    eventId,
    createdIds: [...(captured.createdIds ?? []), ...(attached.createdIds ?? [])],
    headRevisionBefore: (input.ifCaseRevision as number) ?? 0,
    headRevisionAfter: attached.headRevisionAfter,
    projectionScheduled: false
  });
}
