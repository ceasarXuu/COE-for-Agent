export type McpTransportMode = 'stdio' | 'http';

export interface InvestigationServerConfig {
  databaseUrl: string;
  artifactRoot: string;
  otelExporterOtlpEndpoint: string | null;
  mcpTransport: McpTransportMode;
  localIssuerSecret: string;
  port: number;
  version: string;
}

type ConfigSource = Record<string, string | undefined>;

export function loadConfig(source: ConfigSource = process.env): InvestigationServerConfig {
  const transport = source.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
  const port = Number(source.PORT ?? '3000');

  return {
    databaseUrl: source.DATABASE_URL ?? 'postgresql:///postgres',
    artifactRoot: source.ARTIFACT_ROOT ?? './var/artifacts',
    otelExporterOtlpEndpoint: source.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    mcpTransport: transport,
    localIssuerSecret: source.LOCAL_ISSUER_SECRET ?? 'local-dev-secret',
    port: Number.isFinite(port) ? port : 3000,
    version: source.APP_VERSION ?? '0.1.0'
  };
}