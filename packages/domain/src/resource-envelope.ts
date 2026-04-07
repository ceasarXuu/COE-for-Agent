export interface ResourceEnvelope<T> {
  headRevision: number;
  projectionRevision: number;
  requestedRevision: number | null;
  stale: boolean;
  historical: boolean;
  data: T;
}

export interface CreateResourceEnvelopeInput<T> {
  headRevision: number;
  projectionRevision: number;
  requestedRevision?: number | null;
  data: T;
}

export function createResourceEnvelope<T>({
  headRevision,
  projectionRevision,
  requestedRevision = null,
  data
}: CreateResourceEnvelopeInput<T>): ResourceEnvelope<T> {
  return {
    headRevision,
    projectionRevision,
    requestedRevision,
    stale: projectionRevision < headRevision,
    historical: requestedRevision !== null && requestedRevision < headRevision,
    data
  };
}