import type { CommandResult } from '@coe/domain';

import type { InvestigationApp } from '../../src/app.js';

export interface OpenedCase {
  caseId: string;
  inquiryId: string;
  revision: number;
}

export async function openCase(app: InvestigationApp, suffix: string): Promise<OpenedCase> {
  const result = await app.mcpServer.invokeTool('investigation.case.open', {
    idempotencyKey: `e2e-case-open-${suffix}`,
    title: `E2E case ${suffix}`,
    objective: `Validate end-to-end flow ${suffix}`,
    severity: 'critical',
    projectDirectory: `/workspace/e2e-${suffix}`
  });

  return {
    caseId: requiredId(result, 'case_'),
    inquiryId: requiredId(result, 'inquiry_'),
    revision: result.headRevisionAfter
  };
}

export async function advanceStage(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  stage: 'scoping' | 'evidence_collection' | 'hypothesis_competition' | 'discriminative_testing' | 'repair_preparation' | 'repair_validation' | 'closed',
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.case.advance_stage', {
    idempotencyKey: `e2e-stage-${suffix}-${stage}`,
    caseId,
    ifCaseRevision: revision,
    stage,
    reason: `advance to ${stage}`
  });

  return result.headRevisionAfter;
}

export async function reportSymptom(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  suffix: string
): Promise<{ symptomId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.symptom.report', {
    idempotencyKey: `e2e-symptom-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    statement: `critical symptom ${suffix}`,
    severity: 'critical',
    reproducibility: 'always'
  });

  return {
    symptomId: requiredId(result, 'symptom_'),
    revision: result.headRevisionAfter
  };
}

export async function registerEntity(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  suffix: string
): Promise<{ entityId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.entity.register', {
    idempotencyKey: `e2e-entity-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    entityKind: 'service',
    name: `worker-service-${suffix}`,
    locator: {
      kind: 'service',
      name: `worker-service-${suffix}`
    }
  });

  return {
    entityId: requiredId(result, 'entity_'),
    revision: result.headRevisionAfter
  };
}

export async function attachArtifact(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  suffix: string
): Promise<{ artifactId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.artifact.attach', {
    idempotencyKey: `e2e-artifact-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    artifactKind: 'log',
    title: `worker trace ${suffix}`,
    source: {
      uri: `file:///tmp/${suffix}.log`
    },
    excerpt: `trace excerpt ${suffix}`
  });

  return {
    artifactId: requiredId(result, 'artifact_'),
    revision: result.headRevisionAfter
  };
}

export async function assertFact(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  artifactId: string,
  aboutRefs: string[],
  suffix: string
): Promise<{ factId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.fact.assert', {
    idempotencyKey: `e2e-fact-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    statement: `fact ${suffix}`,
    factKind: 'test_result',
    polarity: 'positive',
    sourceArtifactIds: [artifactId],
    aboutRefs,
    observationScope: {
      scopeType: 'manual_observation',
      query: `query ${suffix}`
    }
  });

  return {
    factId: requiredId(result, 'fact_'),
    revision: result.headRevisionAfter
  };
}

export async function proposeHypothesis(
  app: InvestigationApp,
  caseId: string,
  inquiryId: string,
  revision: number,
  symptomId: string,
  factId: string,
  suffix: string
): Promise<{ hypothesisId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.hypothesis.propose', {
    idempotencyKey: `e2e-hypothesis-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    inquiryId,
    title: `hypothesis ${suffix}`,
    statement: `statement ${suffix}`,
    level: 'mechanism',
    explainsSymptomIds: [symptomId],
    dependsOnFactIds: [factId],
    falsificationCriteria: [`falsify ${suffix}`]
  });

  return {
    hypothesisId: requiredId(result, 'hypothesis_'),
    revision: result.headRevisionAfter
  };
}

export async function updateHypothesis(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  hypothesisId: string,
  newStatus: 'active' | 'favored' | 'confirmed',
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.hypothesis.update_status', {
    idempotencyKey: `e2e-hypothesis-status-${suffix}-${newStatus}`,
    caseId,
    ifCaseRevision: revision,
    hypothesisId,
    newStatus,
    reason: `set ${newStatus}`
  });

  return result.headRevisionAfter;
}

export async function planExperiment(
  app: InvestigationApp,
  caseId: string,
  inquiryId: string,
  revision: number,
  hypothesisId: string,
  suffix: string
): Promise<{ experimentId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.experiment.plan', {
    idempotencyKey: `e2e-experiment-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    inquiryId,
    title: `experiment ${suffix}`,
    objective: `objective ${suffix}`,
    method: 'patch_probe',
    testsHypothesisIds: [hypothesisId],
    expectedOutcomes: [{ when: `when ${suffix}`, expect: `expect ${suffix}` }]
  });

  return {
    experimentId: requiredId(result, 'experiment_'),
    revision: result.headRevisionAfter
  };
}

export async function completeExperiment(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  experimentId: string,
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.experiment.record_result', {
    idempotencyKey: `e2e-experiment-result-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    experimentId,
    status: 'completed',
    summary: `completed ${suffix}`
  });

  return result.headRevisionAfter;
}

export async function closeInquiry(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  inquiryId: string,
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.inquiry.close', {
    idempotencyKey: `e2e-inquiry-close-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    inquiryId,
    resolutionKind: 'answered',
    reason: `close ${suffix}`
  });

  return result.headRevisionAfter;
}

export async function recordDecision(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  inquiryId: string,
  factId: string,
  experimentId: string,
  hypothesisId: string,
  suffix: string
): Promise<{ decisionId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.decision.record', {
    idempotencyKey: `e2e-decision-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    inquiryId,
    title: `decision ${suffix}`,
    decisionKind: 'ready_to_patch',
    statement: `decision statement ${suffix}`,
    supportingFactIds: [factId],
    supportingHypothesisIds: [hypothesisId],
    rationale: `rationale ${suffix}`
  });

  return {
    decisionId: requiredId(result, 'decision_'),
    revision: result.headRevisionAfter
  };
}

function requiredId(result: CommandResult, prefix: string): string {
  const id = result.createdIds?.find((value) => value.startsWith(prefix));

  if (!id) {
    throw new Error(`Missing ${prefix} identifier in command result`);
  }

  return id;
}
