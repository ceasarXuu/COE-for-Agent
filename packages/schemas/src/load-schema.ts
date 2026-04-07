import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type JsonSchema = Record<string, unknown>;

export interface LoadedSchema {
  filePath: string;
  schema: JsonSchema;
}

function collectJsonFiles(dirPath: string): string[] {
  return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectJsonFiles(fullPath);
    }

    return entry.name.endsWith('.json') ? [fullPath] : [];
  });
}

export function resolveSchemaRoot(fromDir = import.meta.dirname): string {
  return resolve(fromDir, '../../../schemas');
}

export function loadSchemas(schemaRoot = resolveSchemaRoot()): LoadedSchema[] {
  return collectJsonFiles(schemaRoot).map((filePath) => ({
    filePath,
    schema: JSON.parse(readFileSync(filePath, 'utf8')) as JsonSchema
  }));
}

export function loadSchemaByRelativePath(relativePath: string, schemaRoot = resolveSchemaRoot()): JsonSchema {
  return JSON.parse(readFileSync(join(schemaRoot, relativePath), 'utf8')) as JsonSchema;
}