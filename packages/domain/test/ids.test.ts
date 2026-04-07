import { describe, expect, test } from 'vitest';

import { createCaseId, createFactId, isCaseId } from '../src/ids.js';

describe('domain ids', () => {
  test('creates prefixed identifiers and type guards match', () => {
    const caseId = createCaseId();
    const factId = createFactId();

    expect(caseId).toMatch(/^case_[0-9A-F]{26}$/);
    expect(factId).toMatch(/^fact_[0-9A-F]{26}$/);
    expect(isCaseId(caseId)).toBe(true);
    expect(isCaseId(factId)).toBe(false);
  });
});