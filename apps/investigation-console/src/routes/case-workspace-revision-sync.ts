interface RevisionEnvelope {
  headRevision: number;
  requestedRevision: number | null;
}

interface RevisionWorkspace {
  snapshot: RevisionEnvelope;
  timeline: RevisionEnvelope;
  graph: RevisionEnvelope;
}

export function expectedResourceRevision(routeRevision: number | null, headRevision: number) {
  return routeRevision !== null && routeRevision < headRevision ? routeRevision : null;
}

export function envelopeMatchesRouteRevision(envelope: RevisionEnvelope, routeRevision: number | null) {
  return envelope.requestedRevision === expectedResourceRevision(routeRevision, envelope.headRevision);
}

export function workspaceMatchesRouteRevision(workspace: RevisionWorkspace, routeRevision: number | null) {
  return envelopeMatchesRouteRevision(workspace.snapshot, routeRevision)
    && envelopeMatchesRouteRevision(workspace.timeline, routeRevision)
    && envelopeMatchesRouteRevision(workspace.graph, routeRevision);
}
