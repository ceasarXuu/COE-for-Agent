import type { InvestigationApp } from '../../src/app.js';

interface SeededCaseIds {
  caseId: string;
  inquiryId: string;
}

export interface GraphScenario extends SeededCaseIds {
  focusHypothesisId: string;
  focusSymptomId: string;
  focusExperimentId: string;
  unrelatedHypothesisId: string;
  unrelatedSymptomId: string;
}

export interface CoverageScenario extends SeededCaseIds {
  directSymptomId: string;
  indirectSymptomId: string;
  uncoveredSymptomId: string;
  supportingFactId: string;
}

export interface DiffScenario extends SeededCaseIds {
  hypothesisId: string;
}

export interface ReplayScenario extends SeededCaseIds {
  symptomId: string;
  hypothesisId: string;
}

export interface ProvScenario extends SeededCaseIds {
  artifactId: string;
  factId: string;
}

export async function buildGraphScenario(app: InvestigationApp): Promise<GraphScenario> {
  const { caseId, inquiryId } = await openCase(app, 'Graph slice', 'Build a local graph slice');
  const focusSymptomId = await reportSymptom(app, caseId, 1, 'focus symptom');
  const unrelatedSymptomId = await reportSymptom(app, caseId, 2, 'unrelated symptom');
  const focusHypothesisId = await proposeHypothesis(app, caseId, 3, inquiryId, 'focus hypothesis', [focusSymptomId]);
  const unrelatedHypothesisId = await proposeHypothesis(app, caseId, 4, inquiryId, 'unrelated hypothesis', [unrelatedSymptomId]);
  const focusExperimentId = await planExperiment(app, caseId, 5, inquiryId, focusHypothesisId);

  return {
    caseId,
    inquiryId,
    focusHypothesisId,
    focusSymptomId,
    focusExperimentId,
    unrelatedHypothesisId,
    unrelatedSymptomId
  };
}

export async function buildCoverageScenario(app: InvestigationApp): Promise<CoverageScenario> {
  const { caseId, inquiryId } = await openCase(app, 'Coverage map', 'Measure direct vs indirect evidence');
  const directSymptomId = await reportSymptom(app, caseId, 1, 'direct symptom');
  const indirectSymptomId = await reportSymptom(app, caseId, 2, 'indirect symptom');
  const uncoveredSymptomId = await reportSymptom(app, caseId, 3, 'uncovered symptom');
  const artifactId = await attachArtifact(app, caseId, 4);
  const supportingFactId = await assertFact(app, caseId, 5, artifactId, [directSymptomId]);
  await proposeHypothesis(app, caseId, 6, inquiryId, 'indirect coverage hypothesis', [indirectSymptomId], [supportingFactId]);

  return {
    caseId,
    inquiryId,
    directSymptomId,
    indirectSymptomId,
    uncoveredSymptomId,
    supportingFactId
  };
}

export async function buildDiffScenario(app: InvestigationApp): Promise<DiffScenario> {
  const { caseId, inquiryId } = await openCase(app, 'Diff view', 'Inspect revision transitions');
  const symptomId = await reportSymptom(app, caseId, 1, 'diff symptom');
  const hypothesisId = await proposeHypothesis(app, caseId, 2, inquiryId, 'diff hypothesis', [symptomId]);

  await app.mcpServer.invokeTool('investigation.hypothesis.update_status', {
    idempotencyKey: 'diff-hypothesis-active',
    caseId,
    ifCaseRevision: 3,
    hypothesisId,
    newStatus: 'active',
    reason: 'selected for testing'
  });

  return {
    caseId,
    inquiryId,
    hypothesisId
  };
}

export async function buildReplayScenario(app: InvestigationApp): Promise<ReplayScenario> {
  const { caseId, inquiryId } = await openCase(app, 'Replay view', 'Rebuild a historical revision');
  const symptomId = await reportSymptom(app, caseId, 1, 'replayed symptom');
  const hypothesisId = await proposeHypothesis(app, caseId, 2, inquiryId, 'replayed hypothesis', [symptomId]);

  return {
    caseId,
    inquiryId,
    symptomId,
    hypothesisId
  };
}

export async function buildProvScenario(app: InvestigationApp): Promise<ProvScenario> {
  const { caseId, inquiryId } = await openCase(app, 'PROV export', 'Link evidence lineage');
  const artifactId = await attachArtifact(app, caseId, 1);
  const factId = await assertFact(app, caseId, 2, artifactId, []);

  return {
    caseId,
    inquiryId,
    artifactId,
    factId
  };
}

async function openCase(app: InvestigationApp, title: string, objective: string): Promise<SeededCaseIds> {
  const opened = await app.mcpServer.invokeTool('investigation.case.open', {
    idempotencyKey: `${title}-open`,
    title,
    objective,
    severity: 'high'
  });

  return {
    caseId: opened.createdIds?.find((value) => value.startsWith('case_')) ?? '',
    inquiryId: opened.createdIds?.find((value) => value.startsWith('inquiry_')) ?? ''
  };
}

async function reportSymptom(app: InvestigationApp, caseId: string, ifCaseRevision: number, statement: string): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.symptom.report', {
    idempotencyKey: `${statement}-symptom`,
    caseId,
    ifCaseRevision,
    statement,
    severity: 'high',
    reproducibility: 'always'
  });

  return result.createdIds?.find((value) => value.startsWith('symptom_')) ?? '';
}

async function proposeHypothesis(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  inquiryId: string,
  title: string,
  explainsSymptomIds: string[],
  dependsOnFactIds: string[] = []
): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.hypothesis.propose', {
    idempotencyKey: `${title}-hypothesis`,
    caseId,
    ifCaseRevision,
    inquiryId,
    title,
    statement: `${title} statement`,
    level: 'mechanism',
    explainsSymptomIds,
    dependsOnFactIds,
    falsificationCriteria: [`invalidate ${title}`]
  });

  return result.createdIds?.find((value) => value.startsWith('hypothesis_')) ?? '';
}

async function planExperiment(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  inquiryId: string,
  hypothesisId: string
): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.experiment.plan', {
    idempotencyKey: `${hypothesisId}-experiment`,
    caseId,
    ifCaseRevision,
    inquiryId,
    title: 'focused experiment',
    objective: 'test the focused branch',
    method: 'instrumentation',
    testsHypothesisIds: [hypothesisId],
    expectedOutcomes: [
      {
        when: 'branch executes',
        expect: 'single matching trace'
      }
    ]
  });

  return result.createdIds?.find((value) => value.startsWith('experiment_')) ?? '';
}

async function attachArtifact(app: InvestigationApp, caseId: string, ifCaseRevision: number): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.artifact.attach', {
    idempotencyKey: `artifact-${ifCaseRevision}`,
    caseId,
    ifCaseRevision,
    artifactKind: 'log',
    title: 'application log',
    source: {
      uri: 'file:///tmp/app.log'
    },
    excerpt: 'log excerpt'
  });

  return result.createdIds?.find((value) => value.startsWith('artifact_')) ?? '';
}

async function assertFact(
  app: InvestigationApp,
  caseId: string,
  ifCaseRevision: number,
  artifactId: string,
  aboutRefs: string[]
): Promise<string> {
  const result = await app.mcpServer.invokeTool('investigation.fact.assert', {
    idempotencyKey: `fact-assert-${ifCaseRevision}`,
    caseId,
    ifCaseRevision,
    statement: 'measured fact',
    factKind: 'direct_observation',
    polarity: 'positive',
    sourceArtifactIds: [artifactId],
    aboutRefs,
    observationScope: {
      scopeType: 'manual_observation',
      query: 'observed in log review'
    }
  });

  return result.createdIds?.find((value) => value.startsWith('fact_')) ?? '';
}