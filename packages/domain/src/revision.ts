export class RevisionConflict extends Error {
  readonly code = 'CASE_REVISION_CONFLICT';

  constructor(
    readonly caseId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number
  ) {
    super(`Revision conflict for ${caseId}: expected ${expectedRevision}, got ${actualRevision}`);
    this.name = 'RevisionConflict';
  }
}

export function assertRevisionMatch(caseId: string, expectedRevision: number, actualRevision: number): void {
  if (expectedRevision !== actualRevision) {
    throw new RevisionConflict(caseId, expectedRevision, actualRevision);
  }
}