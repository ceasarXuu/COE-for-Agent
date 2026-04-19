import { GUARDRAIL_TOOL_NAMES, MUTATION_TOOL_NAMES } from '@coe/mcp-contracts/tool-names';
import { loadSchemaByRelativePath, type JsonSchema } from '@coe/schemas';

export interface ToolRegistration {
  name: string;
  inputSchema: JsonSchema;
  description: string;
}

const COMMAND_SCHEMA_BY_TOOL_NAME: Record<string, string> = {
  'investigation.case.open': 'commands/v1/case.open.request.schema.json',
  'investigation.case.advance_stage': 'commands/v1/case.advance_stage.request.schema.json',
  'investigation.problem.update': 'commands/v1/problem.update.request.schema.json',
  'investigation.problem.set_status': 'commands/v1/problem.set_status.request.schema.json',
  'investigation.problem.add_reference_material': 'commands/v1/problem.add_reference_material.request.schema.json',
  'investigation.hypothesis.create': 'commands/v1/hypothesis.create.request.schema.json',
  'investigation.hypothesis.set_status': 'commands/v1/hypothesis.set_status.request.schema.json',
  'investigation.blocker.open': 'commands/v1/blocker.open.request.schema.json',
  'investigation.blocker.close': 'commands/v1/blocker.close.request.schema.json',
  'investigation.repair_attempt.create': 'commands/v1/repair_attempt.create.request.schema.json',
  'investigation.repair_attempt.set_status': 'commands/v1/repair_attempt.set_status.request.schema.json',
  'investigation.evidence.capture': 'commands/v1/evidence.capture.request.schema.json',
  'investigation.evidence.attach_existing': 'commands/v1/evidence.attach_existing.request.schema.json',
  'investigation.evidence.capture_and_attach': 'commands/v1/evidence.capture_and_attach.request.schema.json'
};

const TOOL_DESCRIPTION_BY_NAME: Record<string, string> = {
  'investigation.case.open': 'Open a new investigation case and create its default inquiry.',
  'investigation.case.advance_stage': 'Advance a case to the next investigation lifecycle stage.',
  'investigation.problem.update': 'Update the canonical root problem content for a case.',
  'investigation.problem.set_status': 'Set the canonical root problem status.',
  'investigation.problem.add_reference_material': 'Attach a non-evidentiary reference material item to the canonical root problem.',
  'investigation.hypothesis.create': 'Create a canonical hypothesis node under a problem or hypothesis parent.',
  'investigation.hypothesis.set_status': 'Set the canonical hypothesis lifecycle status.',
  'investigation.blocker.open': 'Open a canonical blocker under a hypothesis.',
  'investigation.blocker.close': 'Close a canonical blocker.',
  'investigation.repair_attempt.create': 'Create a canonical repair-attempt node under a confirmed hypothesis or ineffective repair attempt.',
  'investigation.repair_attempt.set_status': 'Advance the canonical repair-attempt status.',
  'investigation.evidence.capture': 'Capture a reusable canonical evidence entity in the shared evidence pool.',
  'investigation.evidence.attach_existing': 'Attach an existing canonical evidence entity to a hypothesis or repair attempt.',
  'investigation.evidence.capture_and_attach': 'Capture a new canonical evidence entity and attach it in one atomic workflow.',
  'investigation.guardrail.check': 'Evaluate the aggregate investigation guardrail state for a case.',
  'investigation.guardrail.stall_check': 'Evaluate whether the current investigation branch is stalled.',
  'investigation.guardrail.ready_to_patch_check': 'Evaluate whether the current evidence chain is strong enough to enter repair preparation.',
  'investigation.guardrail.close_case_check': 'Evaluate whether the case satisfies all conditions required for closure.'
};

const GUARDRAIL_INPUT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['caseId'],
  properties: {
    caseId: {
      type: 'string'
    },
    atRevision: {
      type: 'integer',
      minimum: 1
    }
  }
};

const ACTOR_CONTEXT_INPUT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actorType', 'actorId', 'sessionId', 'role', 'issuer', 'authMode'],
  properties: {
    actorType: {
      type: 'string',
      enum: ['agent', 'user', 'system', 'adapter', 'tool_runner']
    },
    actorId: {
      type: 'string',
      minLength: 1
    },
    sessionId: {
      type: 'string',
      minLength: 1
    },
    role: {
      type: 'string',
      enum: ['Viewer', 'Operator', 'Reviewer', 'Admin']
    },
    issuer: {
      type: 'string',
      minLength: 1
    },
    authMode: {
      type: 'string',
      enum: ['local', 'oidc', 'service']
    }
  }
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function asProperties(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function withMutationAuthEnvelope(schema: JsonSchema): JsonSchema {
  const required = asStringArray(schema.required);
  const properties = asProperties(schema.properties);

  return {
    ...schema,
    required: required.includes('actorContext') ? required : [...required, 'actorContext'],
    properties: {
      ...properties,
      actorContext: ACTOR_CONTEXT_INPUT_SCHEMA,
      confirmToken: {
        type: 'string',
        minLength: 1
      }
    }
  };
}

export function registerToolDefinitions(): ToolRegistration[] {
  const mutationTools = MUTATION_TOOL_NAMES.map((name) => {
    const schemaPath = COMMAND_SCHEMA_BY_TOOL_NAME[name];
    if (!schemaPath) {
      throw new Error(`Missing command schema mapping for ${name}`);
    }

    return {
      name,
      inputSchema: withMutationAuthEnvelope(loadSchemaByRelativePath(schemaPath)),
      description: TOOL_DESCRIPTION_BY_NAME[name] ?? name
    };
  });

  const guardrailTools = GUARDRAIL_TOOL_NAMES.map((name) => ({
    name,
    inputSchema: GUARDRAIL_INPUT_SCHEMA,
    description: TOOL_DESCRIPTION_BY_NAME[name] ?? name
  }));

  return [...mutationTools, ...guardrailTools];
}
