import { createValidatorMap, loadSchemaByRelativePath, loadSchemas } from '@coe/schemas';
import { expect } from 'vitest';

const validators = createValidatorMap(loadSchemas());

export function expectResourceToMatchSchema(schemaRelativePath: string, resourceData: unknown): void {
  const schema = loadSchemaByRelativePath(schemaRelativePath);
  const schemaId = typeof schema.$id === 'string' ? schema.$id : schemaRelativePath;
  const validate = validators[schemaId];

  expect(validate, `Missing schema validator for ${schemaRelativePath}`).toBeTypeOf('function');

  const valid = validate!(resourceData);
  if (!valid) {
    console.error('[investigation-server] resource-schema-validation.failed', {
      event: 'resource.schema_validation_failed',
      schemaRelativePath,
      errors: validate!.errors
    });
  }

  expect(valid, JSON.stringify(validate!.errors ?? [], null, 2)).toBe(true);
}
