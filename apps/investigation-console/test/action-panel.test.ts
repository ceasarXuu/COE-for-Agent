import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { ActionPanel } from '../src/components/action-panel.js';

describe('action panel', () => {
  test('offers hypothesis escalation, gap creation, and readiness decision actions when a favored hypothesis is selected', () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        currentRevision: 5,
        historical: false,
        onMutationComplete() {
          return;
        },
        selectedNode: {
          id: 'hypothesis_01FIXTUREINVESTIGATE',
          kind: 'hypothesis',
          label: 'worker pool starvation hypothesis',
          status: 'favored'
        },
        guardrails: {
          readyToPatch: {
            pass: true
          },
          closeCase: {
            pass: false
          }
        }
      } as never)
    );

    expect(html).toContain('data-testid="action-confirm-hypothesis"');
    expect(html).toContain('data-testid="action-open-gap"');
    expect(html).toContain('data-testid="action-record-decision"');
  });

  test('freezes the new action set in historical mode', () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        currentRevision: 3,
        historical: true,
        onMutationComplete() {
          return;
        },
        selectedNode: {
          id: 'hypothesis_01FIXTUREINVESTIGATE',
          kind: 'hypothesis',
          label: 'worker pool starvation hypothesis',
          status: 'proposed'
        },
        guardrails: {
          readyToPatch: {
            pass: false
          },
          closeCase: {
            pass: false
          }
        }
      } as never)
    );

    expect(html).toContain('data-testid="action-confirm-hypothesis"');
    expect(html).toContain('disabled');
    expect(html).toContain('Historical mode freezes mutations.');
  });
});