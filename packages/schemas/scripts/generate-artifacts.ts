import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadSchemas } from '../src/load-schema.js';

const generatedDir = join(import.meta.dirname, '../src/generated');
const schemas = loadSchemas(join(import.meta.dirname, '../../../schemas'));

const artifacts = schemas.map((loadedSchema) => ({
  id: typeof loadedSchema.schema.$id === 'string' ? loadedSchema.schema.$id : loadedSchema.filePath,
  filePath: loadedSchema.filePath
}));

writeFileSync(
  join(generatedDir, 'types.ts'),
  [
    'export interface SchemaArtifact {',
    '  id: string;',
    '  filePath: string;',
    '}',
    '',
    'export const generatedSchemaArtifacts = ' + JSON.stringify(artifacts, null, 2) + ' as const;',
    '',
    'export type SchemaId = typeof generatedSchemaArtifacts[number]["id"];',
    ''
  ].join('\n')
);

writeFileSync(
  join(generatedDir, 'index.ts'),
  "export * from './types.js';\nexport * from './validators.js';\n"
);