import { describe, expect, test } from 'vitest';

import {
  createCaseId,
  createEvidenceId,
  createProblemId,
  isCaseId,
  isProblemId
} from '../src/ids.js';

describe('domain ids', () => {
  test('creates prefixed identifiers and type guards match', () => {
    const caseId = createCaseId();
    const problemId = createProblemId();
    const evidenceId = createEvidenceId();

    expect(caseId).toMatch(/^case_[0-9A-F]{26}$/);
    expect(problemId).toMatch(/^problem_[0-9A-F]{26}$/);
    expect(evidenceId).toMatch(/^evidence_[0-9A-F]{26}$/);
    expect(isCaseId(caseId)).toBe(true);
    expect(isProblemId(problemId)).toBe(true);
  });
});
