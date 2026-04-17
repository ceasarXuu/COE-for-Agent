import type { GraphNodeRecord, GuardrailBundle } from '../lib/api.js';

export interface ActionConfig {
  commandName:
    | 'investigation.case.advance_stage'
    | 'investigation.issue.record'
    | 'investigation.issue.resolve'
    | 'investigation.hypothesis.propose'
    | 'investigation.hypothesis.update_status'
    | 'investigation.experiment.plan'
    | 'investigation.experiment.record_result'
    | 'investigation.decision.record';
  title: string;
  rationale: string;
  requiresConfirm: boolean;
  targetIds: string[];
  payload: Record<string, unknown>;
  reset: () => void;
}

export interface ActionPanelProps {
  caseId: string;
  caseStage?: string | null;
  defaultInquiryId?: string | null;
  currentRevision: number;
  historical: boolean;
  selectedNode?: Pick<GraphNodeRecord, 'id' | 'kind' | 'label' | 'status'> | null;
  guardrails?: GuardrailBundle | null;
  onMutationComplete: () => Promise<void> | void;
}
