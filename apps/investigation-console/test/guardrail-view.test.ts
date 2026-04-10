import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { GuardrailView } from '../src/components/guardrail-view.js';

describe('guardrail view', () => {
  test('promotes blocked guardrails even when aggregate warnings are empty', () => {
    const html = renderToStaticMarkup(
      createElement(GuardrailView, {
        guardrails: {
          aggregate: {
            kind: 'investigation.guardrail.check_result',
            warnings: [],
            violations: []
          },
          stall: {
            kind: 'investigation.guardrail.stall_check_result',
            stall: false,
            reason: null
          },
          readyToPatch: {
            kind: 'investigation.guardrail.ready_to_patch_result',
            pass: false
          },
          closeCase: {
            kind: 'investigation.guardrail.close_case_result',
            pass: true
          }
        }
      } as never)
    );

    expect(html).toContain('class="panel panel-warning"');
    expect(html).not.toContain('panel-diagnostic');
  });

  test('keeps clear guardrails in the lower-emphasis diagnostic style', () => {
    const html = renderToStaticMarkup(
      createElement(GuardrailView, {
        guardrails: {
          aggregate: {
            kind: 'investigation.guardrail.check_result',
            warnings: [],
            violations: []
          },
          stall: {
            kind: 'investigation.guardrail.stall_check_result',
            stall: false,
            reason: null
          },
          readyToPatch: {
            kind: 'investigation.guardrail.ready_to_patch_result',
            pass: true
          },
          closeCase: {
            kind: 'investigation.guardrail.close_case_result',
            pass: true
          }
        }
      } as never)
    );

    expect(html).toContain('class="panel panel-diagnostic"');
    expect(html).not.toContain('panel-warning');
  });
});
