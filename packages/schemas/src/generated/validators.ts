import Ajv2020Module, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

import type { LoadedSchema } from '../load-schema.js';

export type ValidatorMap = Record<string, ValidateFunction>;

const Ajv2020 = Ajv2020Module as unknown as typeof import('ajv/dist/2020.js').default;
const addFormats = addFormatsModule as unknown as typeof import('ajv-formats').default;

export function createValidatorMap(loadedSchemas: LoadedSchema[]): ValidatorMap {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  for (const loadedSchema of loadedSchemas) {
    if ('$id' in loadedSchema.schema) {
      ajv.addSchema(loadedSchema.schema);
    }
  }

  return loadedSchemas.reduce<ValidatorMap>((validators, loadedSchema) => {
    const schemaId = typeof loadedSchema.schema.$id === 'string' ? loadedSchema.schema.$id : loadedSchema.filePath;
    validators[schemaId] = ajv.compile(loadedSchema.schema);
    return validators;
  }, {});
}