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
  'investigation.inquiry.open': 'commands/v1/inquiry.open.request.schema.json',
  'investigation.inquiry.close': 'commands/v1/inquiry.close.request.schema.json',
  'investigation.entity.register': 'commands/v1/entity.register.request.schema.json',
  'investigation.symptom.report': 'commands/v1/symptom.report.request.schema.json',
  'investigation.artifact.attach': 'commands/v1/artifact.attach.request.schema.json',
  'investigation.fact.assert': 'commands/v1/fact.assert.request.schema.json',
  'investigation.hypothesis.propose': 'commands/v1/hypothesis.propose.request.schema.json',
  'investigation.hypothesis.update_status': 'commands/v1/hypothesis.update_status.request.schema.json',
  'investigation.experiment.plan': 'commands/v1/experiment.plan.request.schema.json',
  'investigation.experiment.record_result': 'commands/v1/experiment.record_result.request.schema.json',
  'investigation.gap.open': 'commands/v1/gap.open.request.schema.json',
  'investigation.gap.resolve': 'commands/v1/gap.resolve.request.schema.json',
  'investigation.residual.open': 'commands/v1/residual.open.request.schema.json',
  'investigation.residual.update': 'commands/v1/residual.update.request.schema.json',
  'investigation.decision.record': 'commands/v1/decision.record.request.schema.json'
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
      description: `Stub registration for ${name}`
    };
  });

  const guardrailTools = GUARDRAIL_TOOL_NAMES.map((name) => ({
    name,
    inputSchema: GUARDRAIL_INPUT_SCHEMA,
    description: `Stub registration for ${name}`
  }));

  return [...mutationTools, ...guardrailTools];
}