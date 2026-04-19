import { createResourceEnvelope } from '@coe/domain';
import { RESOURCE_URI_TEMPLATES } from '@coe/mcp-contracts/resource-uris';
import { GUARDRAIL_TOOL_NAMES, MUTATION_TOOL_NAMES } from '@coe/mcp-contracts/tool-names';

import type { InvestigationServerConfig } from '../config.js';
import type { InvestigationServerServices } from '../services.js';
import { readCasesResource } from '../modules/resources/cases.js';
import { readDiffResource } from '../modules/resources/diff.js';
import { readEvidencePoolResource } from '../modules/resources/evidence-pool.js';
import { readGraphResource } from '../modules/resources/graph.js';
import { readSnapshotResource } from '../modules/resources/snapshot.js';
import { readTimelineResource } from '../modules/resources/timeline.js';

export interface ResourceReadResult {
  uri: string;
  mimeType: 'application/json';
  data: unknown;
}

export interface ResourceRegistration {
  template: string;
  read(url: URL): Promise<ResourceReadResult>;
}

function parseOptionalInteger(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function createEmptyEnvelope<T>(requestedRevision: number | null, data: T) {
  const envelope = createResourceEnvelope({
    headRevision: 0,
    projectionRevision: 0,
    requestedRevision,
    data
  });

  return requestedRevision === null
    ? envelope
    : {
        ...envelope,
        historical: true
      };
}

export function registerResourceDefinitions(
  config: InvestigationServerConfig,
  services?: InvestigationServerServices
): ResourceRegistration[] {
  return [
    {
      template: RESOURCE_URI_TEMPLATES.profile,
      async read(url) {
        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: {
            profileVersion: '1.0.0',
            mcpSurfaceVersion: '1.0.0',
            capabilities: ['resources', 'tools', 'revision-aware-history'],
            tools: [...MUTATION_TOOL_NAMES, ...GUARDRAIL_TOOL_NAMES],
            resources: Object.values(RESOURCE_URI_TEMPLATES)
          }
        };
      }
    },
    {
      template: RESOURCE_URI_TEMPLATES.cases,
      async read(url) {
        if (services) {
          return readCasesResource(services, url);
        }

        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: createEmptyEnvelope(null, {
            items: []
          })
        };
      }
    },
    {
      template: RESOURCE_URI_TEMPLATES.snapshot,
      async read(url) {
        if (services) {
          return readSnapshotResource(services, url);
        }

        const atRevision = parseOptionalInteger(url.searchParams.get('atRevision'));
        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: createEmptyEnvelope(atRevision, {
            case: null,
            counts: {},
            warnings: []
          })
        };
      }
    },
    {
      template: RESOURCE_URI_TEMPLATES.timeline,
      async read(url) {
        if (services) {
          return readTimelineResource(services, url);
        }

        const atRevision = parseOptionalInteger(url.searchParams.get('atRevision'));
        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: createEmptyEnvelope(atRevision, {
            events: []
          })
        };
      }
    },
    {
      template: RESOURCE_URI_TEMPLATES.graph,
      async read(url) {
        if (services) {
          return readGraphResource(services, url);
        }

        const atRevision = parseOptionalInteger(url.searchParams.get('atRevision'));
        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: createEmptyEnvelope(atRevision, {
            focusId: null,
            nodes: [],
            edges: []
          })
        };
      }
    },
    {
      template: RESOURCE_URI_TEMPLATES.evidencePool,
      async read(url) {
        if (services) {
          return readEvidencePoolResource(services, url);
        }

        const atRevision = parseOptionalInteger(url.searchParams.get('atRevision'));
        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: createEmptyEnvelope(atRevision, {
            items: []
          })
        };
      }
    },
    {
      template: RESOURCE_URI_TEMPLATES.diff,
      async read(url) {
        if (services) {
          return readDiffResource(services, url);
        }

        const fromRevision = parseOptionalInteger(url.searchParams.get('fromRevision')) ?? 0;
        const toRevision = parseOptionalInteger(url.searchParams.get('toRevision')) ?? 0;
        return {
          uri: url.toString(),
          mimeType: 'application/json',
          data: createEmptyEnvelope(null, {
            fromRevision,
            toRevision,
            changedNodeIds: [],
            changedEdgeKeys: [],
            stateTransitions: [],
            summary: []
          })
        };
      }
    }
  ];
}
