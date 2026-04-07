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
    expect(existsSync(join(schemasRoot, 'domain/v1/fact.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/hypothesis.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'domain/v1/decision.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'resources/v1/cases.collection.schema.json'))).toBe(true);
    expect(existsSync(join(schemasRoot, 'resources/v1/case.diff.schema.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'minimal-case.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'history-replay.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'ready-to-patch-blocked.json'))).toBe(true);
    expect(existsSync(join(fixturesRoot, 'close-case-gated.json'))).toBe(true);
  });

  test('rejects fact without sourceArtifactIds', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/fact.schema.json');

    const valid = validate({
      kind: 'investigation.fact',
      id: 'fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2',
      schemaVersion: '1.0.0',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      revision: 1,
      createdAt: '2026-04-06T10:00:00Z',
      createdBy: {
        actorType: 'agent',
        actorId: 'claude-code'
      },
      statement: 'duplicate message observed',
      factKind: 'direct_observation',
      polarity: 'positive'
    });

    expect(valid).toBe(false);
  });

  test('rejects negative fact without observationScope', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/fact.schema.json');

    const valid = validate({
      kind: 'investigation.fact',
      id: 'fact_01JQ9Y6M9F6P8J8B0YQ3F4A1M2',
      schemaVersion: '1.0.0',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      revision: 1,
      createdAt: '2026-04-06T10:00:00Z',
      createdBy: {
        actorType: 'agent',
        actorId: 'claude-code'
      },
      statement: 'no invalidation found',
      factKind: 'absence_observation',
      polarity: 'negative',
      sourceArtifactIds: ['artifact_01JQ9Y5H2K4M6N8P0Q2R4S6T8U']
    });

    expect(valid).toBe(false);
  });

  test('rejects hypothesis without falsificationCriteria', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/hypothesis.schema.json');

    const valid = validate({
      kind: 'investigation.hypothesis',
      id: 'hypothesis_01JQ9Z12AB34CD56EF78GH90JK',
      schemaVersion: '1.0.0',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      inquiryId: 'inquiry_01JQ9Y3F1G2H3J4K5L6M7N8P9Q',
      revision: 1,
      createdAt: '2026-04-06T10:00:00Z',
      createdBy: {
        actorType: 'agent',
        actorId: 'claude-code'
      },
      title: 'cache invalidation missing',
      statement: 'cache invalidation does not fire',
      level: 'mechanism',
      status: 'active',
      explainsSymptomIds: ['symptom_01JQ9Y4P6Q8R0S2T4U6V8W0X2Y']
    });

    expect(valid).toBe(false);
  });

  test('rejects decision without supporting facts or experiments', () => {
    const ajv = createAjv();
    const validate = getRegisteredValidator(ajv, 'https://schemas.coe.local/domain/v1/decision.schema.json');

    const valid = validate({
      kind: 'investigation.decision',
      id: 'decision_01JQA0QW2E3R4T5Y6U7I8O9P0A',
      schemaVersion: '1.0.0',
      caseId: 'case_01JQ9Y2D3E5H7K9M1N2P3Q4R5S',
      revision: 1,
      createdAt: '2026-04-06T10:00:00Z',
      createdBy: {
        actorType: 'agent',
        actorId: 'claude-code'
      },
      title: 'ready to patch',
      decisionKind: 'ready_to_patch',
      statement: 'we are ready'
    });

    expect(valid).toBe(false);
  });
});