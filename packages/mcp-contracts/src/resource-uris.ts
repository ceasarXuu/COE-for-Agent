export const RESOURCE_URI_TEMPLATES = {
  profile: 'investigation://profile',
  cases: 'investigation://cases',
  snapshot: 'investigation://cases/{caseId}/snapshot',
  timeline: 'investigation://cases/{caseId}/timeline',
  graph: 'investigation://cases/{caseId}/graph',
  evidencePool: 'investigation://cases/{caseId}/evidence-pool',
  diff: 'investigation://cases/{caseId}/diff'
} as const;

export type ResourceUriTemplate = (typeof RESOURCE_URI_TEMPLATES)[keyof typeof RESOURCE_URI_TEMPLATES];
