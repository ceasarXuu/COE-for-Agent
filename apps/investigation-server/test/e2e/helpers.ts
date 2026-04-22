import type { InvestigationApp } from '../../src/app.js';

export interface OpenedCase {
  caseId: string;
  problemId: string;
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
    problemId: requiredId(result, 'problem_'),
    revision: result.headRevisionAfter
  };
}

export async function closeCase(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.case.close', {
    idempotencyKey: `e2e-case-close-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    reason: `close ${suffix}`
  });

  return result.headRevisionAfter;
}

export async function updateProblem(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  problemId: string,
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.problem.update', {
    idempotencyKey: `e2e-problem-update-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    problemId,
    environment: `env ${suffix}`,
    symptoms: [`critical symptom ${suffix}`],
    resolutionCriteria: [`resolution criteria ${suffix}`]
  });

  return result.headRevisionAfter;
}

export async function createHypothesis(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  parentNodeId: string,
  suffix: string
): Promise<{ hypothesisId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
    idempotencyKey: `e2e-hypothesis-create-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    parentNodeId,
    statement: `hypothesis ${suffix}`,
    falsificationCriteria: [`falsify ${suffix}`]
  });

  return {
    hypothesisId: requiredId(result, 'hypothesis_'),
    revision: result.headRevisionAfter
  };
}

export async function setHypothesisStatus(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  hypothesisId: string,
  newStatus: 'confirmed' | 'blocked' | 'rejected' | 'unverified',
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
    idempotencyKey: `e2e-hypothesis-status-${suffix}-${newStatus}`,
    caseId,
    ifCaseRevision: revision,
    hypothesisId,
    newStatus,
    reason: `set ${newStatus}`
  });

  return result.headRevisionAfter;
}

export async function createRepairAttempt(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  parentNodeId: string,
  suffix: string
): Promise<{ repairAttemptId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
    idempotencyKey: `e2e-repair-create-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    parentNodeId,
    changeSummary: `repair attempt ${suffix}`
  });

  return {
    repairAttemptId: requiredId(result, 'repair_attempt_'),
    revision: result.headRevisionAfter
  };
}

export async function setRepairAttemptStatus(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  repairAttemptId: string,
  newStatus: 'running' | 'effective' | 'ineffective',
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.repair_attempt.set_status', {
    idempotencyKey: `e2e-repair-status-${suffix}-${newStatus}`,
    caseId,
    ifCaseRevision: revision,
    repairAttemptId,
    newStatus,
    reason: `set ${newStatus}`
  });

  return result.headRevisionAfter;
}

export async function attachValidationEvidence(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  parentNodeId: string,
  suffix: string
): Promise<{ evidenceRefId: string; revision: number }> {
  const result = await app.mcpServer.invokeTool('investigation.evidence.capture_and_attach', {
    idempotencyKey: `e2e-evidence-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    parentNodeId,
    kind: 'experiment_result',
    title: `validation result ${suffix}`,
    summary: `validation summary ${suffix}`,
    provenance: `validation-run-${suffix}`,
    effectOnParent: 'validates',
    interpretation: `validation interpretation ${suffix}`
  });

  return {
    evidenceRefId: requiredId(result, 'evidence_ref_'),
    revision: result.headRevisionAfter
  };
}

export async function resolveProblem(
  app: InvestigationApp,
  caseId: string,
  revision: number,
  problemId: string,
  suffix: string
): Promise<number> {
  const result = await app.mcpServer.invokeTool('investigation.problem.set_status', {
    idempotencyKey: `e2e-problem-status-${suffix}`,
    caseId,
    ifCaseRevision: revision,
    problemId,
    newStatus: 'resolved',
    reason: `resolved ${suffix}`
  });

  return result.headRevisionAfter;
}

function requiredId(result: { createdIds?: string[] }, prefix: string): string {
  const id = result.createdIds?.find((value) => value.startsWith(prefix));

  if (!id) {
    throw new Error(`Missing ${prefix} identifier in command result`);
  }

  return id;
}
