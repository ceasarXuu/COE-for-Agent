import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { ActionPanel } from '../src/components/action-panel.js';

describe('action panel', () => {
  test('offers hypothesis escalation, gap creation, and readiness decision actions when a favored hypothesis is selected', () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        caseStage: 'discriminative_testing',
        defaultInquiryId: 'inquiry_01FIXTUREINVESTIGATION',
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
    expect(html).toContain('data-testid="action-plan-experiment"');
  });

  test('freezes the new action set in historical mode', () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        caseStage: 'hypothesis_competition',
        defaultInquiryId: 'inquiry_01FIXTUREINVESTIGATION',
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
    expect(html).toContain('Historical');
  });

  test('offers symptom follow-up actions for proposing a hypothesis and opening residual risk', () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        caseStage: 'evidence_collection',
        defaultInquiryId: 'inquiry_01FIXTUREINVESTIGATION',
        currentRevision: 4,
        historical: false,
        onMutationComplete() {
          return;
        },
        selectedNode: {
          id: 'symptom_01FIXTUREINVESTIGATE',
          kind: 'symptom',
          label: 'worker fanout stalls',
          status: 'open'
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

    expect(html).toContain('data-testid="action-propose-hypothesis"');
    expect(html).toContain('data-testid="action-open-residual"');
  });

  test('offers inquiry and experiment completion actions when those nodes are selected', () => {
    const inquiryHtml = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        caseStage: 'discriminative_testing',
        defaultInquiryId: 'inquiry_01FIXTUREINVESTIGATION',
        currentRevision: 6,
        historical: false,
        onMutationComplete() {
          return;
        },
        selectedNode: {
          id: 'inquiry_01FIXTUREINVESTIGATION',
          kind: 'inquiry',
          label: 'Default inquiry',
          status: 'open'
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

    const experimentHtml = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        caseStage: 'discriminative_testing',
        defaultInquiryId: 'inquiry_01FIXTUREINVESTIGATION',
        currentRevision: 7,
        historical: false,
        onMutationComplete() {
          return;
        },
        selectedNode: {
          id: 'experiment_01FIXTUREINVESTIGATE',
          kind: 'experiment',
          label: 'Patch probe',
          status: 'planned'
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

    expect(inquiryHtml).toContain('data-testid="action-close-inquiry"');
    expect(experimentHtml).toContain('data-testid="action-record-experiment-result"');
  });

  test('does not render case-level stage advancement controls when no node is selected', () => {
    const html = renderToStaticMarkup(
      createElement(ActionPanel, {
        caseId: 'case_01FIXTUREINVESTIGATION0001',
        caseStage: 'repair_validation',
        defaultInquiryId: 'inquiry_01FIXTUREINVESTIGATION',
        currentRevision: 9,
        historical: false,
        onMutationComplete() {
          return;
        },
        selectedNode: null,
        guardrails: {
          readyToPatch: {
            pass: true
          },
          closeCase: {
            pass: true
          }
        }
      } as never)
    );

    expect(html).not.toContain('data-testid="action-advance-stage"');
    expect(html).not.toContain('Close case');
    expect(html).not.toContain('推进到修复准备');
    expect(html).not.toContain('data-testid="closure-decision-rationale"');
  });
});
