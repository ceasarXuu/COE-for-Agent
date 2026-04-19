import type { InvestigationApp } from '../../src/app.js';

interface SeededCaseIds {
  caseId: string;
  problemId: string;
}

export interface GraphScenario extends SeededCaseIds {
  focusHypothesisId: string;
  focusRepairAttemptId: string;
  unrelatedHypothesisId: string;
}

export interface DiffScenario extends SeededCaseIds {
  hypothesisId: string;
}

export interface ReplayScenario extends SeededCaseIds {
  hypothesisId: string;
}

export interface ProvScenario extends SeededCaseIds {
  hypothesisId: string;
  repairAttemptId: string;
  evidenceId: string;
  evidenceRefId: string;
}

export async function buildGraphScenario(app: InvestigationApp): Promise<GraphScenario> {
  const { caseId, problemId } = await openCase(app, 'Graph slice', 'Build a canonical graph slice');
  const focusHypothesisId = await createHypothesis(app, caseId, 1, problemId, 'focus hypothesis');
  const unrelatedHypothesisId = await createHypothesis(app, caseId, 2, problemId, 'unrelated hypothesis');
  await setHypothesisStatus(app, caseId, 3, focusHypothesisId, 'confirmed');
  const focusRepairAttemptId = await createRepairAttempt(app, caseId, 4, focusHypothesisId, 'focused repair attempt');

  return {
    caseId,
    problemId,
    focusHypothesisId,
    focusRepairAttemptId,
    unrelatedHypothesisId
  };
}

export async function buildDiffScenario(app: InvestigationApp): Promise<DiffScenario> {
  const { caseId, problemId } = await openCase(app, 'Diff view', 'Inspect canonical revision transitions');
  const hypothesisId = await createHypothesis(app, caseId, 1, problemId, 'diff hypothesis');
  await setHypothesisStatus(app, caseId, 2, hypothesisId, 'confirmed');

  return {
    caseId,
    problemId,
    hypothesisId
  };
}

export async function buildReplayScenario(app: InvestigationApp): Promise<ReplayScenario> {
  const { caseId, problemId } = await openCase(app, 'Replay view', 'Rebuild a historical canonical revision');
  await updateProblem(app, caseId, 1, problemId);
  const hypothesisId = await createHypothesis(app, caseId, 2, problemId, 'replayed hypothesis');

  return {
    caseId,
    problemId,
    hypothesisId
  };
}

export async function buildProvScenario(app: InvestigationApp): Promise<ProvScenario> {
  const { caseId, problemId } = await openCase(app, 'PROV export', 'Link canonical evidence lineage');
  const hypothesisId = await createHypothesis(app, caseId, 1, problemId, 'prov hypothesis');
  await setHypothesisStatus(app, caseId, 2, hypothesisId, 'confirmed');
  const repairAttemptId = await createRepairAttempt(app, caseId, 3, hypothesisId, 'prov repair attempt');
  await setRepairAttemptStatus(app, caseId, 4, repairAttemptId, 'running');
  const attached = await captureAndAttachEvidence(app, caseId, 5, repairAttemptId);

  return {
    caseId,
    problemId,
    hypothesisId,
    repairAttemptId,
    evidenceId: attached.evidenceId,
    evidenceRefId: attached.evidenceRefId
  };
}

async function openCase(app: InvestigationApp, title: string, objective: string): Promise<SeededCaseIds> {
  const opened = await app.mcpServer.invokeTool('investigation.case.open', {
    idempotencyKey: `${title}-open`,
    title,
    objective,
    severity: 'high',
    projectDirectory: `/workspace/${title.replace(/\s+/g, '-').toLowerCase()}`
  });

  return {
    caseId: findCreatedId(opened.createdIds, 'case_'),
    problemId: findCreatedId(opened.createdIds, 'problem_')
  };
}

async function updateProblem(app: InvestigationApp, caseId: string, ifCaseRevision: number, problemId: string): Promise<void> {
  await app.mcpServer.invokeTool('investigation.problem.update', {
    idempotencyKey: `problem-update-${ifCaseRevision}`,
    caseId,
    ifCaseRevision,
    problemId,
    environment: 'replay-env',
    symptoms: ['canonical symptom'],
    resolutionCriteria: ['canonical resolution']
  });
}

async function createHypothesis(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  parentNodeId: string,
  title: string
): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.hypothesis.create', {
    idempotencyKey: `${title}-hypothesis`,
    caseId,
    ifCaseRevision,
    parentNodeId,
    title,
    statement: `${title} statement`,
    falsificationCriteria: [`invalidate ${title}`]
  });

  return findCreatedId(result.createdIds, 'hypothesis_');
}

async function setHypothesisStatus(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  hypothesisId: string,
  newStatus: 'confirmed' | 'blocked' | 'rejected' | 'unverified'
): Promise<void> {
  await app.mcpServer.invokeTool('investigation.hypothesis.set_status', {
    idempotencyKey: `${hypothesisId}-${newStatus}`,
    caseId,
    ifCaseRevision,
    hypothesisId,
    newStatus,
    reason: `set ${newStatus}`
  });
}

async function createRepairAttempt(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  parentNodeId: string,
  changeSummary: string
): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.repair_attempt.create', {
    idempotencyKey: `${parentNodeId}-repair`,
    caseId,
    ifCaseRevision,
    parentNodeId,
    changeSummary
  });

  return findCreatedId(result.createdIds, 'repair_attempt_');
}

async function setRepairAttemptStatus(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  repairAttemptId: string,
  newStatus: 'running' | 'effective' | 'ineffective'
): Promise<void> {
  await app.mcpServer.invokeTool('investigation.repair_attempt.set_status', {
    idempotencyKey: `${repairAttemptId}-${newStatus}`,
    caseId,
    ifCaseRevision,
    repairAttemptId,
    newStatus,
    reason: `set ${newStatus}`
  });
}

async function captureAndAttachEvidence(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  parentNodeId: string
): Promise<{ evidenceId: string; evidenceRefId: string }> {
  const result = await app.mcpServer.invokeTool('investigation.evidence.capture_and_attach', {
    idempotencyKey: `${parentNodeId}-evidence`,
    caseId,
    ifCaseRevision,
    parentNodeId,
    kind: 'experiment_result',
    title: 'canonical evidence',
    summary: 'captured canonical validation result',
    provenance: 'resource-scenario',
    effectOnParent: 'validates',
    interpretation: 'attached to the canonical parent'
  });

  return {
    evidenceId: findCreatedId(result.createdIds, 'evidence_'),
    evidenceRefId: findCreatedId(result.createdIds, 'evidence_ref_')
  };
}

function findCreatedId(createdIds: unknown, prefix: string): string {
  if (!Array.isArray(createdIds)) {
    throw new Error(`Missing ${prefix} identifier in command result`);
  }

  const id = createdIds.find((value): value is string => typeof value === 'string' && value.startsWith(prefix));
  if (!id) {
    throw new Error(`Missing ${prefix} identifier in command result`);
  }

  return id;
}
