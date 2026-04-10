import path from 'node:path';

export type McpTransportMode = 'stdio' | 'http';

export interface InvestigationServerConfig {
  dataDir: string;
  artifactRoot: string;
  otelExporterOtlpEndpoint: string | null;
  mcpTransport: McpTransportMode;
  localIssuerSecret: string;
  port: number;
  version: string;
}

type ConfigSource = Record<string, string | undefined>;

function resolveProjectPath(value: string, fallback: string): string {
  const repoRoot = path.resolve(import.meta.dirname, '../../../');
  const target = value.length > 0 ? value : fallback;
  return path.isAbsolute(target) ? target : path.resolve(repoRoot, target);
}

export function loadConfig(source: ConfigSource = process.env): InvestigationServerConfig {
  const transport = source.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
  const port = Number(source.PORT ?? '3000');

  return {
    dataDir: resolveProjectPath(source.COE_DATA_DIR ?? '', './.var/data'),
    artifactRoot: resolveProjectPath(source.ARTIFACT_ROOT ?? '', './artifacts'),
    otelExporterOtlpEndpoint: source.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    mcpTransport: transport,
    localIssuerSecret: source.LOCAL_ISSUER_SECRET ?? 'local-dev-secret',
    port: Number.isFinite(port) ? port : 3000,
    version: source.APP_VERSION ?? '0.1.0'
  };
}
