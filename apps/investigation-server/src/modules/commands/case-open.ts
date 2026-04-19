import { createCaseId, createCommandResult, createProblemId } from '@coe/domain';
import { CaseListProjectionRepository, CurrentStateRepository, EventStoreRepository } from '@coe/persistence';

import type { InvestigationServerServices, InvestigationServerTransaction } from '../../services.js';
import { asValidatedInput, executeIdempotentMutation, requireActorContext, toJsonValue } from './shared.js';

interface CaseOpenInput {
  idempotencyKey: string;
  title: string;
  objective: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  projectDirectory: string;
  labels?: string[];
}

export async function handleCaseOpen(
  services: InvestigationServerServices,
  input: Record<string, unknown>
) {
  const payload = asValidatedInput<CaseOpenInput>(input);
  const actorContext = requireActorContext(input);

  return services.db.transaction().execute(async (trx: InvestigationServerTransaction) =>
    executeIdempotentMutation(
      trx,
      {
        commandName: 'investigation.case.open',
        idempotencyKey: payload.idempotencyKey,
        actorContext
      },
      async () => {
        const eventStore = new EventStoreRepository(trx);
        const currentState = new CurrentStateRepository(trx);
        const caseList = new CaseListProjectionRepository(trx);

        const caseId = createCaseId();
        const problemId = createProblemId();
        const result = await eventStore.appendEventInExecutor(trx, {
          caseId,
          expectedRevision: 0,
          eventType: 'case.opened',
          commandName: 'investigation.case.open',
          actor: actorContext,
          payload: toJsonValue({
            caseId,
            title: payload.title,
            objective: payload.objective,
            severity: payload.severity,
            projectDirectory: payload.projectDirectory,
            defaultProblemId: problemId
          }),
          metadata: toJsonValue({
            idempotencyKey: payload.idempotencyKey
          }) as { idempotencyKey: string }
        });

        await currentState.upsertCase({
          id: caseId,
          title: payload.title,
          severity: payload.severity,
          status: 'active',
          stage: 'intake',
          revision: result.caseRevision,
          payload: toJsonValue({
            id: caseId,
            title: payload.title,
            objective: payload.objective,
            severity: payload.severity,
            projectDirectory: payload.projectDirectory,
            labels: payload.labels ?? [],
            defaultProblemId: problemId,
            status: 'active',
            stage: 'intake'
          })
        });

        await currentState.upsertRecord('problems', {
          id: problemId,
          caseId,
          revision: result.caseRevision,
          status: 'open',
          payload: toJsonValue({
            id: problemId,
            caseId,
            title: payload.title,
            description: payload.objective,
            environment: '',
            symptoms: [],
            resolutionCriteria: [],
            referenceMaterials: [],
            status: 'open'
          })
        });

        await caseList.upsert({
          caseId,
          title: payload.title,
          summary: payload.objective,
          severity: payload.severity,
          status: 'active',
          stage: 'intake'
        });

        return createCommandResult({
          ok: true,
          eventId: result.eventId,
          createdIds: [caseId, problemId],
          headRevisionBefore: 0,
          headRevisionAfter: result.caseRevision,
          projectionScheduled: false
        });
      }
    )
  );
}
