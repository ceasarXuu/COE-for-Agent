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
  'investigation.issue.record': 'commands/v1/issue.record.request.schema.json',
  'investigation.issue.resolve': 'commands/v1/issue.resolve.request.schema.json',
  'investigation.context.register': 'commands/v1/context.register.request.schema.json',
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

const TOOL_DESCRIPTION_BY_NAME: Record<string, string> = {
  'investigation.case.open': 'Open a new investigation case and create its default inquiry.',
  'investigation.case.advance_stage': 'Advance a case to the next investigation lifecycle stage.',
  'investigation.problem.update': 'Update the canonical root problem content for a case.',
  'investigation.problem.set_status': 'Set the canonical root problem status.',
  'investigation.problem.add_reference_material': 'Attach a non-evidentiary reference material item to the canonical root problem.',
  'investigation.issue.record': 'Record a canonical issue and route it to the compatible legacy investigation model.',
  'investigation.issue.resolve': 'Resolve a canonical issue by routing to the compatible legacy lifecycle command.',
  'investigation.context.register': 'Register investigation context using the simplified context terminology.',
  'investigation.inquiry.open': 'Open a follow-on inquiry inside an existing case.',
  'investigation.inquiry.close': 'Close or merge an existing inquiry.',
  'investigation.entity.register': 'Register an entity referenced by the investigation evidence graph.',
  'investigation.symptom.report': 'Report a symptom observed during the investigation.',
  'investigation.artifact.attach': 'Attach an investigation artifact such as a log, trace, or document excerpt.',
  'investigation.fact.assert': 'Assert a fact backed by artifacts and scoped observations.',
  'investigation.hypothesis.propose': 'Propose a hypothesis that explains one or more symptoms.',
  'investigation.hypothesis.update_status': 'Update the status of an existing hypothesis.',
  'investigation.experiment.plan': 'Plan an experiment to test one or more hypotheses.',
  'investigation.experiment.record_result': 'Record the outcome of a planned experiment.',
  'investigation.gap.open': 'Open a blocking investigation gap on the current branch.',
  'investigation.gap.resolve': 'Resolve an existing investigation gap.',
  'investigation.residual.open': 'Open a residual risk that still needs explicit treatment.',
  'investigation.residual.update': 'Update the treatment state of a residual risk.',
  'investigation.decision.record': 'Record a reviewer or operator decision on the current investigation branch.',
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
