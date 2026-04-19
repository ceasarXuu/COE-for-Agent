export interface PromptArgumentDefinition {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  title: string;
  description: string;
  arguments?: PromptArgumentDefinition[];
  buildMessages(args: Record<string, string>): Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

function stringArg(args: Record<string, string>, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: 'coe_investigate_issue',
    title: 'COE Investigate Issue',
    description: 'Open and structure a new investigation case before taking repair actions.',
    arguments: [
      {
        name: 'problem',
        description: 'The issue or question that should become the investigation target.',
        required: true
      },
      {
        name: 'environment',
        description: 'Optional environment label such as dev, staging, or prod.'
      }
    ],
    buildMessages(args) {
      const problem = stringArg(args, 'problem', 'Unspecified issue');
      const environment = stringArg(args, 'environment', 'dev');

      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Use the COE investigation MCP surface to open a new case for: ${problem}.\n` +
              `Treat ${environment} as the working environment label.\n` +
              'Create or update the root problem, derive hypotheses from it, and only branch into repair attempts after a hypothesis is confirmed.'
          }
        }
      ];
    }
  },
  {
    name: 'coe_ready_to_patch',
    title: 'COE Ready To Patch',
    description: 'Evaluate whether a case has enough evidence to enter repair preparation.',
    arguments: [
      {
        name: 'caseId',
        description: 'The investigation case identifier to evaluate.',
        required: true
      }
    ],
    buildMessages(args) {
      const caseId = stringArg(args, 'caseId', 'missing-case-id');

      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Review investigation case ${caseId} through MCP resources, summarize the current evidence chain, ` +
              'run the ready_to_patch guardrail, and explain any active blockers on the confirmed branch.'
          }
        }
      ];
    }
  },
  {
    name: 'coe_reviewer_handoff',
    title: 'COE Reviewer Handoff',
    description: 'Prepare a concise reviewer handoff grounded in canonical graph state and guardrails.',
    arguments: [
      {
        name: 'caseId',
        description: 'The investigation case identifier for the handoff.',
        required: true
      }
    ],
    buildMessages(args) {
      const caseId = stringArg(args, 'caseId', 'missing-case-id');

      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Prepare a reviewer handoff for investigation case ${caseId}. ` +
              'Summarize the case snapshot, timeline, root problem state, active hypotheses, blockers, repair attempts, ' +
              'and any reviewer-only actions that still require explicit confirmation.'
          }
        }
      ];
    }
  }
];

export function findPromptDefinition(name: string): PromptDefinition | null {
  return PROMPT_DEFINITIONS.find((prompt) => prompt.name === name) ?? null;
}
