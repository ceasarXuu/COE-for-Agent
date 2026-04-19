export const DEFAULT_CONSOLE_BFF_PORT: number;
export const DEFAULT_CONSOLE_WEB_PORT: number;

export function isPortAvailable(port: number): Promise<boolean>;

export function resolvePortPlan(options: {
  requestedWebPort: number;
  requestedBffPort: number;
  explicitWebPort: boolean;
  explicitBffPort: boolean;
  isPortAvailable: (port: number) => Promise<boolean>;
}): Promise<{
  webPort: number;
  bffPort: number;
}>;