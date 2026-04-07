export interface CommandResult {
  ok: boolean;
  warnings: string[];
  violations: string[];
  headRevisionBefore: number;
  headRevisionAfter: number;
  projectionScheduled: boolean;
  eventId?: string;
  createdIds?: string[];
  updatedIds?: string[];
  errorCode?: string;
  message?: string;
}

export function createCommandResult(
  input: Omit<CommandResult, 'warnings' | 'violations'> & {
    warnings?: string[];
    violations?: string[];
  }
): CommandResult {
  return {
    warnings: input.warnings ?? [],
    violations: input.violations ?? [],
    ...input
  };
}