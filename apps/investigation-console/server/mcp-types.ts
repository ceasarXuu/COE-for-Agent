export interface ResourceReadResult {
  uri: string;
  mimeType: string;
  data: unknown;
}

export interface ConsoleMcpClient {
  readResource(uri: string): Promise<ResourceReadResult>;
  invokeTool(name: string, input: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}