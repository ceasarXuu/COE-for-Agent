import { randomBytes } from 'node:crypto';
import path from 'node:path';

export type McpTransportMode = 'stdio' | 'http';

export interface InvestigationServerConfig {
  dataDir: string;
  otelExporterOtlpEndpoint: string | null;
  mcpTransport: McpTransportMode;
  localIssuerSecret: string;
  port: number;
  version: string;
}

type ConfigSource = Record<string, string | undefined>;

const MIN_SECRET_LENGTH = 32;
const INSECURE_PLACEHOLDER_SECRETS = new Set([
  'local-dev-secret',
  'dev-local-issuer-secret',
  'changeme',
  'secret'
]);

function resolveProjectPath(value: string, fallback: string): string {
  const repoRoot = path.resolve(import.meta.dirname, '../../../');
  const target = value.length > 0 ? value : fallback;
  return path.isAbsolute(target) ? target : path.resolve(repoRoot, target);
}

function isProductionEnvironment(source: ConfigSource): boolean {
  return source.NODE_ENV === 'production';
}

function resolveLocalIssuerSecret(source: ConfigSource): string {
  const provided = source.LOCAL_ISSUER_SECRET?.trim();

  if (provided && provided.length > 0) {
    if (provided.length < MIN_SECRET_LENGTH && isProductionEnvironment(source)) {
      throw new Error(
        `LOCAL_ISSUER_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`
      );
    }

    if (INSECURE_PLACEHOLDER_SECRETS.has(provided) && isProductionEnvironment(source)) {
      throw new Error(
        'LOCAL_ISSUER_SECRET is set to a known insecure placeholder; refuse to start in production'
      );
    }

    return provided;
  }

  if (isProductionEnvironment(source)) {
    throw new Error(
      'LOCAL_ISSUER_SECRET is required when NODE_ENV=production; refuse to start with a default secret'
    );
  }

  // Dev/test fallback: generate an ephemeral per-process secret. Cross-process
  // verification (e.g. between server and console BFF) requires both sides to
  // be launched with the same explicit LOCAL_ISSUER_SECRET.
  const ephemeral = randomBytes(32).toString('base64url');
  console.warn(JSON.stringify({
    event: 'config.local_issuer_secret.ephemeral',
    severity: 'warn',
    message: 'LOCAL_ISSUER_SECRET not set; generated ephemeral per-process secret. Set LOCAL_ISSUER_SECRET to enable cross-process verification.'
  }));
  return ephemeral;
}

export function loadConfig(source: ConfigSource = process.env): InvestigationServerConfig {
  const transport = source.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
  const port = Number(source.PORT ?? '3000');

  return {
    dataDir: resolveProjectPath(source.COE_DATA_DIR ?? '', './.var/data'),
    otelExporterOtlpEndpoint: source.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    mcpTransport: transport,
    localIssuerSecret: resolveLocalIssuerSecret(source),
    port: Number.isFinite(port) ? port : 3000,
    version: source.APP_VERSION ?? '0.1.0'
  };
}
