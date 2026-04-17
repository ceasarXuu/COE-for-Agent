import { registerResourceDefinitions, type ResourceReadResult, type ResourceRegistration } from './register-resources.js';
import { registerToolDefinitions, type ToolRegistration } from './register-tools.js';

import Ajv2020Module, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { CommandResult } from '@coe/domain';
import { MUTATION_TOOL_NAMES, type GuardrailToolName, type MutationToolName } from '@coe/mcp-contracts/tool-names';

import type { InvestigationServerConfig } from '../config.js';
import type { InvestigationServerServices } from '../services.js';
import { authorizeMutationCommand } from '../auth/authorize-command.js';
import { investigationTelemetry } from '../telemetry.js';
import { handleArtifactAttach } from '../modules/commands/artifact-attach.js';
import { handleCaseAdvanceStage } from '../modules/commands/case-advance-stage.js';
import { handleCaseOpen } from '../modules/commands/case-open.js';
import { handleContextRegister } from '../modules/commands/context-register.js';
import { handleDecisionRecord } from '../modules/commands/decision-record.js';
import { handleEntityRegister } from '../modules/commands/entity-register.js';
import { handleEvidenceAttachExisting } from '../modules/commands/evidence-attach-existing.js';
import { handleEvidenceCaptureAndAttach } from '../modules/commands/evidence-capture-and-attach.js';
import { handleEvidenceCapture } from '../modules/commands/evidence-capture.js';
import { handleExperimentPlan } from '../modules/commands/experiment-plan.js';
import { handleExperimentRecordResult } from '../modules/commands/experiment-record-result.js';
import { handleFactAssert } from '../modules/commands/fact-assert.js';
import { handleBlockerClose } from '../modules/commands/blocker-close.js';
import { handleBlockerOpen } from '../modules/commands/blocker-open.js';
import { handleGapOpen } from '../modules/commands/gap-open.js';
import { handleGapResolve } from '../modules/commands/gap-resolve.js';
import { handleHypothesisCreate } from '../modules/commands/hypothesis-create.js';
import { handleHypothesisPropose } from '../modules/commands/hypothesis-propose.js';
import { handleHypothesisSetStatus } from '../modules/commands/hypothesis-set-status.js';
import { handleHypothesisUpdateStatus } from '../modules/commands/hypothesis-update-status.js';
import { handleInquiryClose } from '../modules/commands/inquiry-close.js';
import { handleInquiryOpen } from '../modules/commands/inquiry-open.js';
import { handleProblemAddReferenceMaterial } from '../modules/commands/problem-add-reference-material.js';
import { handleProblemSetStatus } from '../modules/commands/problem-set-status.js';
import { handleProblemUpdate } from '../modules/commands/problem-update.js';
import { handleRepairAttemptCreate } from '../modules/commands/repair-attempt-create.js';
import { handleRepairAttemptSetStatus } from '../modules/commands/repair-attempt-set-status.js';
import { handleIssueRecord } from '../modules/commands/issue-record.js';
import { handleIssueResolve } from '../modules/commands/issue-resolve.js';
import { handleResidualOpen } from '../modules/commands/residual-open.js';
import { handleResidualUpdate } from '../modules/commands/residual-update.js';
import { handleSymptomReport } from '../modules/commands/symptom-report.js';
import { handleGuardrailCheck } from '../modules/guardrails/check.js';
import { handleGuardrailCloseCaseCheck } from '../modules/guardrails/close-case.js';
import { handleGuardrailReadyToPatchCheck } from '../modules/guardrails/ready-to-patch.js';
import { handleGuardrailStallCheck } from '../modules/guardrails/stall-check.js';

const Ajv2020 = Ajv2020Module as unknown as typeof import('ajv/dist/2020.js').default;
const addFormats = addFormatsModule as unknown as typeof import('ajv-formats').default;
const MUTATION_TOOL_NAME_SET = new Set<string>(MUTATION_TOOL_NAMES);

function escapeRegex(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function templateToPattern(template: string): RegExp {
  const escaped = escapeRegex(template).replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

export interface CreateInvestigationMcpServerOptions {
  config: InvestigationServerConfig;
  services?: InvestigationServerServices;
}

type ToolResult = CommandResult | Record<string, unknown>;
type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

function isCommandResult(value: ToolResult): value is CommandResult {
  return typeof value === 'object'
    && value !== null
    && 'headRevisionAfter' in value
    && typeof value.headRevisionAfter === 'number';
}

function extractCaseId(name: string, input: Record<string, unknown>, result: ToolResult): string | null {
  if (typeof input.caseId === 'string' && input.caseId.length > 0) {
    return input.caseId;
  }

  if (name === 'investigation.case.open' && isCommandResult(result)) {
    return result.createdIds?.find((value) => value.startsWith('case_')) ?? null;
  }

  return null;
}

export class InvestigationMcpServer {
  private readonly resourceRegistry: Array<{
    template: string;
    pattern: RegExp;
    resource: ResourceRegistration;
  }>;
  private readonly toolValidators: Map<string, ValidateFunction>;
  private readonly toolHandlers: Map<string, (input: Record<string, unknown>) => Promise<ToolResult>>;

  constructor(
    readonly config: InvestigationServerConfig,
    private readonly resources: ResourceRegistration[],
    private readonly tools: ToolRegistration[],
    services?: InvestigationServerServices
  ) {
    this.resourceRegistry = resources.map((resource) => ({
      template: resource.template,
      pattern: templateToPattern(resource.template),
      resource
    }));

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    this.toolValidators = new Map(
      tools.map((tool) => [tool.name, ajv.compile(tool.inputSchema)])
    );
    const toolHandlers: Array<[string, ToolHandler]> = services
      ? [
            ['investigation.case.open', (input) => handleCaseOpen(services, input)],
            ['investigation.case.advance_stage', (input) => handleCaseAdvanceStage(services, input)],
            ['investigation.problem.update', (input) => handleProblemUpdate(services, input)],
            ['investigation.problem.set_status', (input) => handleProblemSetStatus(services, input)],
            ['investigation.problem.add_reference_material', (input) => handleProblemAddReferenceMaterial(services, input)],
            ['investigation.hypothesis.create', (input) => handleHypothesisCreate(services, input)],
            ['investigation.hypothesis.set_status', (input) => handleHypothesisSetStatus(services, input)],
            ['investigation.blocker.open', (input) => handleBlockerOpen(services, input)],
            ['investigation.blocker.close', (input) => handleBlockerClose(services, input)],
            ['investigation.repair_attempt.create', (input) => handleRepairAttemptCreate(services, input)],
            ['investigation.repair_attempt.set_status', (input) => handleRepairAttemptSetStatus(services, input)],
            ['investigation.evidence.capture', (input) => handleEvidenceCapture(services, input)],
            ['investigation.evidence.attach_existing', (input) => handleEvidenceAttachExisting(services, input)],
            ['investigation.evidence.capture_and_attach', (input) => handleEvidenceCaptureAndAttach(services, input)],
            ['investigation.issue.record', (input) => handleIssueRecord(services, input)],
            ['investigation.issue.resolve', (input) => handleIssueResolve(services, input)],
            ['investigation.context.register', (input) => handleContextRegister(services, input)],
            ['investigation.inquiry.open', (input) => handleInquiryOpen(services, input)],
            ['investigation.inquiry.close', (input) => handleInquiryClose(services, input)],
            ['investigation.entity.register', (input) => handleEntityRegister(services, input)],
            ['investigation.symptom.report', (input) => handleSymptomReport(services, input)],
            ['investigation.artifact.attach', (input) => handleArtifactAttach(services, input)],
            ['investigation.fact.assert', (input) => handleFactAssert(services, input)],
            ['investigation.hypothesis.propose', (input) => handleHypothesisPropose(services, input)],
            ['investigation.hypothesis.update_status', (input) => handleHypothesisUpdateStatus(services, input)],
            ['investigation.experiment.plan', (input) => handleExperimentPlan(services, input)],
            ['investigation.experiment.record_result', (input) => handleExperimentRecordResult(services, input)],
            ['investigation.gap.open', (input) => handleGapOpen(services, input)],
            ['investigation.gap.resolve', (input) => handleGapResolve(services, input)],
            ['investigation.residual.open', (input) => handleResidualOpen(services, input)],
            ['investigation.residual.update', (input) => handleResidualUpdate(services, input)],
            ['investigation.decision.record', (input) => handleDecisionRecord(services, input)],
            ['investigation.guardrail.check', (input) => handleGuardrailCheck(services, input)],
            ['investigation.guardrail.stall_check', (input) => handleGuardrailStallCheck(services, input)],
            ['investigation.guardrail.ready_to_patch_check', (input) => handleGuardrailReadyToPatchCheck(services, input)],
            ['investigation.guardrail.close_case_check', (input) => handleGuardrailCloseCaseCheck(services, input)]
          ]
      : [];
    this.toolHandlers = new Map<string, ToolHandler>(toolHandlers);
  }

  listResourceTemplates(): string[] {
    return this.resourceRegistry.map((resource) => resource.template);
  }

  listTools(): ToolRegistration[] {
    return [...this.tools];
  }

  async readResource(uri: string): Promise<ResourceReadResult> {
    const startedAt = Date.now();
    const url = new URL(uri);
    const resourceKey = `${url.protocol}//${url.host}${url.pathname}`;
    const registration = this.resourceRegistry.find((resource) => resource.pattern.test(resourceKey));

    if (!registration) {
      investigationTelemetry.recordResourceRead({
        uri,
        success: false,
        durationMs: Date.now() - startedAt
      });
      throw new Error(`Unknown resource: ${uri}`);
    }

    try {
      const result = await registration.resource.read(url);
      investigationTelemetry.recordResourceRead({
        uri,
        success: true,
        durationMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      investigationTelemetry.recordResourceRead({
        uri,
        success: false,
        durationMs: Date.now() - startedAt
      });
      throw error;
    }
  }

  async invokeTool(name: MutationToolName, input: Record<string, unknown>): Promise<CommandResult>;
  async invokeTool(name: GuardrailToolName, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  async invokeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const startedAt = Date.now();
    const validator = this.toolValidators.get(name);
    if (!validator) {
      investigationTelemetry.recordToolCall({
        name,
        success: false,
        durationMs: Date.now() - startedAt
      });
      throw new Error(`Unknown tool: ${name}`);
    }

    if (!validator(input)) {
      investigationTelemetry.recordToolCall({
        name,
        success: false,
        durationMs: Date.now() - startedAt
      });
      throw new Error(formatValidationErrors(validator.errors ?? []));
    }

    const handler = this.toolHandlers.get(name);
    if (!handler) {
      investigationTelemetry.recordToolCall({
        name,
        success: false,
        durationMs: Date.now() - startedAt
      });
      throw new Error(`Tool not implemented: ${name}`);
    }

    try {
      if (MUTATION_TOOL_NAME_SET.has(name)) {
        authorizeMutationCommand({
          commandName: name as MutationToolName,
          input,
          secret: this.config.localIssuerSecret
        });
      }

      const result = await handler(input);
      const durationMs = Date.now() - startedAt;

      if (name.startsWith('investigation.guardrail.')) {
        investigationTelemetry.recordGuardrailEvaluate({
          name,
          success: true,
          durationMs
        });
      } else {
        investigationTelemetry.recordToolCall({
          name,
          success: true,
          durationMs
        });
      }

      if (MUTATION_TOOL_NAME_SET.has(name) && isCommandResult(result)) {
        const caseId = extractCaseId(name, input, result);
        if (caseId) {
          investigationTelemetry.emitCaseHeadRevisionChanged({
            caseId,
            headRevision: result.headRevisionAfter,
            ...(result.eventId ? { eventId: result.eventId } : {})
          });
        }
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (name.startsWith('investigation.guardrail.')) {
        investigationTelemetry.recordGuardrailEvaluate({
          name,
          success: false,
          durationMs
        });
      } else {
        investigationTelemetry.recordToolCall({
          name,
          success: false,
          durationMs
        });
      }
      throw error;
    }
  }
}

function formatValidationErrors(errors: ErrorObject[]): string {
  return errors
    .map((error) => {
      const instancePath = error.instancePath || '/';
      const missingProperty = typeof error.params === 'object' && error.params !== null && 'missingProperty' in error.params
        ? String(error.params.missingProperty)
        : null;
      return missingProperty ? `${instancePath} missing ${missingProperty}` : `${instancePath} ${error.message ?? 'validation failed'}`;
    })
    .join('; ');
}

export function createInvestigationMcpServer({ config, services }: CreateInvestigationMcpServerOptions): InvestigationMcpServer {
  const resources = registerResourceDefinitions(config, services);
  const tools = registerToolDefinitions();

  return new InvestigationMcpServer(config, resources, tools, services);
}
