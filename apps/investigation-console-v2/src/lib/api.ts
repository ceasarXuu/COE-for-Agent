import {
  createConsoleApiClient,
  type CaseDiffEnvelope,
  type CaseEvidencePoolEnvelope,
  type CaseGraphEnvelope,
  type CaseListEnvelope,
  type CaseListItem,
  type CaseSnapshotEnvelope,
  type CaseTimelineEnvelope,
  type CreateCaseInput,
  type CreateCaseResult,
  type GraphNodeRecord,
  type SessionBundle
} from '@coe/console-client/api';

const apiClient = createConsoleApiClient({
  logScope: '[investigation-console-v2]'
});

export type {
  CaseDiffEnvelope,
  CaseEvidencePoolEnvelope,
  CaseGraphEnvelope,
  CaseListEnvelope,
  CaseListItem,
  CaseSnapshotEnvelope,
  CaseTimelineEnvelope,
  CreateCaseInput,
  CreateCaseResult,
  GraphNodeRecord,
  SessionBundle
};

export const listCases = apiClient.listCases;
export const createCase = apiClient.createCase;
export const getCaseSnapshot = apiClient.getCaseSnapshot;
export const getCaseTimeline = apiClient.getCaseTimeline;
export const getCaseGraph = apiClient.getCaseGraph;
export const getCaseEvidencePool = apiClient.getCaseEvidencePool;
export const getCaseDiff = apiClient.getCaseDiff;
export const invokeTool = apiClient.invokeTool;
export const requestConfirmIntent = apiClient.requestConfirmIntent;
export const resetConsoleClientSessionCache = apiClient.resetSessionCache;
