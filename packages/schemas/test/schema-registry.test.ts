import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { AnySchemaObject } from 'ajv';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');
const schemasRoot = join(repoRoot, 'schemas');
const fixturesRoot = join(repoRoot, 'tests/conformance');
const Ajv2020 = Ajv2020Module as unknown as typeof import('ajv/dist/2020.js').default;
const addFormats = addFormatsModule as unknown as typeof import('ajv-formats').default;

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function collectSchemaFiles(dirPath: string): string[] {
  return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectSchemaFiles(fullPath);
    }

    return entry.name.endsWith('.json') ? [fullPath] : [];
  });
}

function createAjv(): InstanceType<typeof Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  for (const schemaPath of collectSchemaFiles(schemasRoot)) {
    const schema = readJson<AnySchemaObject>(schemaPath);
    if (typeof schema === 'object' && schema !== null && '$id' in schema) {
      ajv.addSchema(schema);
    }
  }

  return ajv;
}

function getRegisteredValidator(ajv: InstanceType<typeof Ajv2020>, schemaId: string) {
  const validate = ajv.getSchema(schemaId);
  expect(validate).toBeTypeOf('function');
  return validate!;
}

describe('schema registry', () => {
  test('loads required schema files and conformance fixtures', () => {
    expect(existsSync(join(schemasRoot, 'common/base-node.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/problem.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/hypothesis.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/blocker.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/repair_attempt.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/evidence.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/evidence_ref.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'events/v1/canonical.evidence.attached.data.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'events/v1/canonical.hypothesis.created.data.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'resources/v1/cases.collection.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'resources/v1/case.diff.schema.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'minimal-case.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'history-replay.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'ready-to-patch-blocked.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'close-case-gated.json'))).toBe(true);
  });

  test('rejects problem without title', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/problem.schema.json');

    const valid = validate({
      kind: 'investigation.problem',
      id: 'problem_01JQ9Y6M9F6P8J8B0YQ3F4A1M2',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      status: 'open'
    });

    expect(valid).toBe(false);
  });

  test('rejects evidence_ref without effectOnParent', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/evidence_ref.schema.json');

    const valid = validate({
      kind: 'investigation.evidence_ref',
      id: 'evidence_ref_01JQ9Y6M9F6P8J8B0YQ3F4A1M2',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      parentNodeId: 'repair_attempt_01JQ9Y5H2K4M6N8P0Q2R4S6T8U',
      evidenceId: 'evidence_01JQ9Y5H2K4M6N8P0Q2R4S6T8U'
    });

    expect(valid).toBe(false);
  });

  test('rejects hypothesis without falsificationCriteria', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/hypothesis.schema.json');

    const valid = validate({
      kind: 'investigation.hypothesis',
      id: 'hypothesis_01JQ9Z12AB34CD56EF78GH90JK',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      parentNodeId: 'problem_01JQ9Y3F1G2H3J4K5L6M7N8P9Q',
      parentNodeKind: 'problem',
      title: 'cache invalidation missing',
      statement: 'cache invalidation does not fire',
      status: 'unverified'
    });

    expect(valid).toBe(false);
  });

  test('rejects repair_attempt without changeSummary', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/repair_attempt.schema.json');

    const valid = validate({
      kind: 'investigation.repair_attempt',
      id: 'repair_attempt_01JQA0QW2E3R4T5Y6U7I8O9P0A',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      parentNodeId: 'hypothesis_01JQ9Z12AB34CD56EF78GH90JK',
      parentNodeKind: 'hypothesis',
      status: 'proposed'
    });

    expect(valid).toBe(false);
  });
});
