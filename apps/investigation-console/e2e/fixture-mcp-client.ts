import { createResourceEnvelope } from '@coe/domain';

import type { ConsoleMcpClient, ResourceReadResult } from '../server/mcp-types.js';

import type { ManualCaseState, RevisionState } from './fixtures/types.js';
import {
  FIXTURE_IDS,
  clone,
  requireString,
  parseResourceUri,
  pickRevision,
  detectProjectionModel,
  pushRevision
} from './fixtures/helpers.js';
import { buildRevisionStates, buildConfirmedRevision } from './fixtures/revision-data.js';
import {
  buildManualCaseState,
  recordManualHypothesis,
  updateManualHypothesis,
  updateManualHypothesisStatus,
  recordManualBlocker,
  updateManualBlocker,
  closeManualBlocker,
  recordManualRepairAttempt,
  updateManualRepairAttempt,
  updateManualRepairAttemptStatus,
  captureManualEvidence,
  attachManualEvidence,
  updateManualEvidenceRef,
  updateManualProblem,
  updateManualProblemStatus,
  manualGuardrails
} from './fixtures/manual-case-state.js';

export { FIXTURE_IDS };

// ---------------------------------------------------------------------------
// Graph helpers (kept local — they read from RevisionState without mutations)
// ---------------------------------------------------------------------------

function readFocusedGraph(state: RevisionState, focusId: string | null) {
  if (!focusId) {
    return {
      focusId: null,
      projectionModel: detectProjectionModel(state.nodes),
      nodes: clone(state.nodes),
      edges: clone(state.edges)
    };
  }

  const relatedNodeIds = new Set<string>([focusId]);
  const edges = state.edges.filter((edge) => edge.fromId === focusId || edge.toId === focusId);
  for (const edge of edges) {
    relatedNodeIds.add(edge.fromId);
    relatedNodeIds.add(edge.toId);
  }

  const filteredNodes = state.nodes.filter((node) => relatedNodeIds.has(node.id));
  return {
    focusId,
    projectionModel: detectProjectionModel(filteredNodes),
    nodes: filteredNodes.map(clone),
    edges: edges.map(clone)
  };
}

function readDiff(states: RevisionState[], fromRevision: number, toRevision: number) {
  const before = pickRevision(states, fromRevision);
  const after = pickRevision(states, toRevision);
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const changedNodeIds = new Set<string>();
  const stateTransitions: Array<{ nodeId: string; kind: string; fromStatus: string | null; toStatus: string | null }> = [];

  for (const nodeId of new Set([...beforeNodes.keys(), ...afterNodes.keys()])) {
    const prevNode = beforeNodes.get(nodeId);
    const nextNode = afterNodes.get(nodeId);
    if (!prevNode || !nextNode) {
      changedNodeIds.add(nodeId);
      continue;
    }

    if (prevNode.status !== nextNode.status || prevNode.label !== nextNode.label || prevNode.revision !== nextNode.revision) {
      changedNodeIds.add(nodeId);
    }

    if (prevNode.status !== nextNode.status) {
      stateTransitions.push({
        nodeId,
        kind: nextNode.kind,
        fromStatus: prevNode.status,
        toStatus: nextNode.status
      });
    }
  }

  const beforeEdgeKeys = new Set(before.edges.map((edge) => edge.key));
  const afterEdgeKeys = new Set(after.edges.map((edge) => edge.key));
  const changedEdgeKeys = [...new Set([
    ...[...beforeEdgeKeys].filter((key) => !afterEdgeKeys.has(key)),
    ...[...afterEdgeKeys].filter((key) => !beforeEdgeKeys.has(key))
  ])].sort();

  return {
    fromRevision: before.revision,
    toRevision: after.revision,
    changedNodeIds: [...changedNodeIds].sort(),
    changedEdgeKeys,
    stateTransitions,
    summary: [
      `${changedNodeIds.size} nodes changed`,
      `${stateTransitions.length} state transitions`,
      `${changedEdgeKeys.length} edges changed`
    ]
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createFixtureMcpClient(): ConsoleMcpClient {
  const revisions = buildRevisionStates();
  const manualCases = new Map<string, ManualCaseState>();
  let manualCaseSequence = 1;

  return {
    async readResource(uri: string): Promise<ResourceReadResult> {
      const parsed = parseResourceUri(uri);
      const requestedRevisionRaw = parsed.url.searchParams.get('atRevision');
      const requestedRevision = requestedRevisionRaw ? Number(requestedRevisionRaw) : null;
      const state = pickRevision(revisions, Number.isInteger(requestedRevision) ? requestedRevision : null);
      const headRevision = revisions[revisions.length - 1]!.revision;

      if (parsed.collection !== 'cases') {
        throw new Error(`Unsupported resource collection: ${parsed.collection}`);
      }

      // ---- Case listing (no segments) ----
      if (parsed.segments.length === 0) {
        const query = (
          parsed.url.searchParams.get('search')
          ?? parsed.url.searchParams.get('q')
          ?? ''
        ).trim().toLowerCase();
        const caseItems = [
          {
            caseId: FIXTURE_IDS.caseId,
            title: state.caseRecord.title,
            summary: state.caseRecord.summary,
            status: state.caseRecord.status,
            stage: state.caseRecord.stage,
            severity: state.caseRecord.severity,
            headRevision,
            updatedAt: '2025-01-01T10:16:00.000Z'
          },
          ...Array.from(manualCases.values()).map((mc) => ({
            caseId: mc.caseId,
            title: mc.title,
            summary: mc.objective,
            status: 'active',
            stage: 'intake',
            severity: mc.severity,
            headRevision: mc.headRevision,
            updatedAt: mc.updatedAt
          }))
        ].filter((item) => {
          if (query.length === 0) return true;
          return [
            item.caseId,
            item.title,
            item.summary,
            ...(item.caseId === FIXTURE_IDS.caseId ? [state.caseRecord.objective] : [])
          ]
            .filter((v): v is string => typeof v === 'string')
            .some((v) => v.toLowerCase().includes(query));
        });

        return {
          uri,
          mimeType: 'application/json',
          data: createResourceEnvelope({
            headRevision,
            projectionRevision: headRevision,
            data: { items: caseItems }
          })
        };
      }

      // ---- Single-case resources ----
      const caseId = parsed.segments[0] ?? '';
      const resourceName = parsed.segments[1];
      const manualCase = manualCases.get(caseId);

      if (caseId !== FIXTURE_IDS.caseId && !manualCase) {
        throw new Error(`Unknown case ${caseId}`);
      }

      if (manualCase) {
        return readManualCaseResource(uri, manualCase, resourceName);
      }

      return readFixtureCaseResource(uri, state, revisions, headRevision, parsed, resourceName);
    },

    async invokeTool(name: string, input: Record<string, unknown>) {
      const headState = revisions[revisions.length - 1]!;
      const manualCase = typeof input.caseId === 'string' ? manualCases.get(input.caseId) : null;

      switch (name) {
        // ---- Case lifecycle ----
        case 'investigation.case.open': {
          const created = buildManualCaseState(input, manualCaseSequence++);
          manualCases.set(created.caseId, created);
          return {
            ok: true,
            headRevisionBefore: 0,
            headRevisionAfter: 1,
            projectionScheduled: false,
            createdIds: [created.caseId, created.problemId],
            warnings: [],
            violations: []
          };
        }

        // ---- Guardrails ----
        case 'investigation.guardrail.check':
          return manualCase ? clone(manualGuardrails().aggregate) : clone(headState.guardrails.aggregate);
        case 'investigation.guardrail.stall_check':
          return manualCase ? clone(manualGuardrails().stall) : clone(headState.guardrails.stall);
        case 'investigation.guardrail.ready_to_patch_check':
          return manualCase ? clone(manualGuardrails().readyToPatch) : clone(headState.guardrails.readyToPatch);
        case 'investigation.guardrail.close_case_check':
          return manualCase ? clone(manualGuardrails().closeCase) : clone(headState.guardrails.closeCase);

        // ---- Manual-case-only tools ----
        case 'investigation.hypothesis.create':
          if (manualCase) return recordManualHypothesis(manualCase, input);
          throw new Error('fixture only supports canonical hypothesis.create for manual cases');
        case 'investigation.hypothesis.update':
          if (manualCase) return updateManualHypothesis(manualCase, input);
          throw new Error('fixture only supports canonical hypothesis.update for manual cases');
        case 'investigation.blocker.open':
          if (manualCase) return recordManualBlocker(manualCase, input);
          throw new Error('fixture only supports canonical blocker.open for manual cases');
        case 'investigation.blocker.update':
          if (manualCase) return updateManualBlocker(manualCase, input);
          throw new Error('fixture only supports canonical blocker.update for manual cases');
        case 'investigation.blocker.close':
          if (manualCase) return closeManualBlocker(manualCase, input);
          throw new Error('fixture only supports canonical blocker.close for manual cases');
        case 'investigation.repair_attempt.create':
          if (manualCase) return recordManualRepairAttempt(manualCase, input);
          throw new Error('fixture only supports canonical repair_attempt.create for manual cases');
        case 'investigation.repair_attempt.update':
          if (manualCase) return updateManualRepairAttempt(manualCase, input);
          throw new Error('fixture only supports canonical repair_attempt.update for manual cases');
        case 'investigation.repair_attempt.set_status':
          if (manualCase) return updateManualRepairAttemptStatus(manualCase, input);
          throw new Error('fixture only supports canonical repair_attempt.set_status for manual cases');
        case 'investigation.evidence.capture':
          if (manualCase) return captureManualEvidence(manualCase, input);
          throw new Error('fixture only supports canonical evidence.capture for manual cases');
        case 'investigation.evidence.attach_existing':
          if (manualCase) return attachManualEvidence(manualCase, input);
          throw new Error('fixture only supports canonical evidence.attach_existing for manual cases');
        case 'investigation.evidence_ref.update':
          if (manualCase) return updateManualEvidenceRef(manualCase, input);
          throw new Error('fixture only supports canonical evidence_ref.update for manual cases');
        case 'investigation.evidence.capture_and_attach': {
          if (!manualCase) throw new Error('fixture only supports canonical evidence.capture_and_attach for manual cases');
          const capture = captureManualEvidence(manualCase, input);
          const evidenceId = capture.createdIds?.[0];
          if (!evidenceId) throw new Error('fixture canonical evidence capture failed');
          const attach = attachManualEvidence(manualCase, {
            ...input,
            ifCaseRevision: capture.headRevisionAfter,
            evidenceId
          });
          return {
            ok: true,
            headRevisionBefore: capture.headRevisionBefore,
            headRevisionAfter: attach.headRevisionAfter,
            projectionScheduled: false,
            createdIds: [...(capture.createdIds ?? []), ...(attach.createdIds ?? [])],
            warnings: [],
            violations: []
          };
        }
        case 'investigation.problem.update':
          if (manualCase) return updateManualProblem(manualCase, input);
          throw new Error('fixture only supports canonical problem.update for manual cases');
        case 'investigation.problem.set_status':
          if (manualCase) return updateManualProblemStatus(manualCase, input);
          throw new Error('fixture only supports canonical problem.set_status for manual cases');

        // ---- Fixture-case-only tools ----
        case 'investigation.hypothesis.set_status': {
          if (manualCase) return updateManualHypothesisStatus(manualCase, input);

          if (typeof input.caseId !== 'string' || input.caseId !== FIXTURE_IDS.caseId) {
            throw new Error('fixture only supports canonical hypothesis.set_status for the seeded case');
          }
          if (typeof input.confirmToken !== 'string' || input.confirmToken.length === 0) {
            throw new Error('confirmToken is required');
          }
          if (input.newStatus !== 'confirmed') {
            throw new Error('fixture only supports confirmed canonical hypothesis transitions');
          }
          if (revisions[revisions.length - 1]!.revision < 6) {
            pushRevision(revisions, buildConfirmedRevision(revisions[revisions.length - 1]!));
          }
          const nextState = revisions[revisions.length - 1]!;
          return {
            ok: true,
            headRevisionBefore: headState.revision,
            headRevisionAfter: nextState.revision,
            projectionScheduled: false,
            updatedIds: [requireString(input, 'hypothesisId')],
            warnings: [],
            violations: []
          };
        }
        default:
          throw new Error(`Unsupported tool ${name}`);
      }
    },

    async close() {
      return;
    }
  };
}

// ---------------------------------------------------------------------------
// Resource readers (extracted for readability, keep close to routing)
// ---------------------------------------------------------------------------

function readManualCaseResource(
  uri: string,
  manualCase: ManualCaseState,
  resourceName: string | undefined
): ResourceReadResult {
  switch (resourceName) {
    case 'snapshot':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision: manualCase.headRevision,
          projectionRevision: manualCase.headRevision,
          data: {
            case: {
              id: manualCase.caseId,
              title: manualCase.title,
              objective: manualCase.objective,
              severity: manualCase.severity,
              status: 'active',
              stage: 'intake',
              revision: manualCase.headRevision,
              projectDirectory: manualCase.projectDirectory,
              labels: manualCase.labels
            },
            counts: clone(manualCase.counts),
            warnings: []
          }
        })
      };
    case 'timeline':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision: manualCase.headRevision,
          projectionRevision: manualCase.headRevision,
          data: { events: clone(manualCase.timeline) }
        })
      };
    case 'graph':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision: manualCase.headRevision,
          projectionRevision: manualCase.headRevision,
          data: {
            focusId: null,
            projectionModel: detectProjectionModel(manualCase.nodes),
            nodes: clone(manualCase.nodes),
            edges: clone(manualCase.edges)
          }
        })
      };
    case 'evidence-pool':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision: manualCase.headRevision,
          projectionRevision: manualCase.headRevision,
          data: {
            items: manualCase.evidencePool.map((item) => ({
              evidenceId: item.id,
              kind: 'other',
              title: item.title,
              summary: item.summary,
              provenance: 'manual://graph-canvas',
              confidence: null,
              revision: manualCase.headRevision
            }))
          }
        })
      };
    case 'diff':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision: manualCase.headRevision,
          projectionRevision: manualCase.headRevision,
          data: {
            fromRevision: manualCase.headRevision,
            toRevision: manualCase.headRevision,
            changedNodeIds: [],
            changedEdgeKeys: [],
            stateTransitions: [],
            summary: ['No diff']
          }
        })
      };
    default:
      throw new Error(`Unsupported resource ${resourceName}`);
  }
}

function readFixtureCaseResource(
  uri: string,
  state: RevisionState,
  revisions: RevisionState[],
  headRevision: number,
  parsed: ReturnType<typeof parseResourceUri>,
  resourceName: string | undefined
): ResourceReadResult {
  switch (resourceName) {
    case 'snapshot':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision,
          projectionRevision: state.revision,
          requestedRevision: state.revision < headRevision ? state.revision : null,
          data: {
            case: clone(state.caseRecord),
            counts: clone(state.counts),
            warnings: []
          }
        })
      };
    case 'timeline':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision,
          projectionRevision: state.revision,
          requestedRevision: state.revision < headRevision ? state.revision : null,
          data: { events: clone(state.timeline) }
        })
      };
    case 'graph':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision,
          projectionRevision: state.revision,
          requestedRevision: state.revision < headRevision ? state.revision : null,
          data: readFocusedGraph(state, parsed.url.searchParams.get('focusId'))
        })
      };
    case 'evidence-pool':
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision,
          projectionRevision: state.revision,
          requestedRevision: state.revision < headRevision ? state.revision : null,
          data: {
            items: extractEvidencePoolItems(state)
          }
        })
      };
    case 'diff': {
      const fromRevision = Number(parsed.url.searchParams.get('fromRevision') ?? '0');
      const toRevision = Number(parsed.url.searchParams.get('toRevision') ?? headRevision);
      return {
        uri,
        mimeType: 'application/json',
        data: createResourceEnvelope({
          headRevision,
          projectionRevision: Math.min(toRevision, headRevision),
          requestedRevision: toRevision < headRevision ? toRevision : null,
          data: readDiff(revisions, fromRevision, toRevision)
        })
      };
    }
    default:
      throw new Error(`Unsupported resource ${resourceName}`);
  }
}

function extractEvidencePoolItems(state: RevisionState) {
  return state.nodes
    .filter((node) => node.kind === 'evidence_ref')
    .map((node) => {
      const evidenceRecord = isObjectRecord(node.payload?.evidence) ? node.payload?.evidence : null;
      return {
        evidenceId: typeof evidenceRecord?.id === 'string' ? evidenceRecord.id : node.id,
        kind: 'other',
        title: typeof evidenceRecord?.title === 'string' ? evidenceRecord.title : node.label,
        summary: typeof evidenceRecord?.summary === 'string' ? evidenceRecord.summary : node.summary ?? null,
        provenance: typeof evidenceRecord?.provenance === 'string' ? evidenceRecord.provenance : null,
        confidence: null,
        revision: node.revision
      };
    });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
