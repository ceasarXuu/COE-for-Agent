import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { CaseNodeEditor } from '../src/components/workspace/node-editor.js';
import { I18nProvider } from '../src/lib/i18n.js';

function renderEditor(props: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      initialLocale: 'en',
      children: createElement(CaseNodeEditor, props as never)
    })
  );
}

describe('v2 case node editor', () => {
  test('renders historical saved text fields as copyable read-only controls without save actions', () => {
    const html = renderEditor({
      caseId: 'case_01',
      currentRevision: 3,
      historical: true,
      selectedNode: {
        id: 'hypothesis_01',
        kind: 'hypothesis',
        label: 'Worker pool starvation',
        status: 'unverified',
        revision: 3,
        payload: {
          title: 'Worker pool starvation',
          statement: 'Worker pool starvation',
          falsificationCriteria: ['Queue depth stays flat under replay']
        }
      },
      selectedDraftNode: null,
      onPatchDraftNode() {
        return;
      },
      onDiscardDraftNode() {
        return;
      },
      onMutationComplete() {
        return;
      }
    });

    expect(html).not.toContain('data-testid="node-editor-save"');
    expect(html).toMatch(/data-testid="node-editor-hypothesis-title"(?=[^>]*readonly)/i);
    expect(html).toMatch(/data-testid="node-editor-hypothesis-statement"(?=[^>]*readonly)/i);
    expect(html).not.toMatch(/data-testid="node-editor-hypothesis-statement"(?=[^>]*disabled)/i);
    expect(html).toMatch(/data-testid="node-editor-status"(?=[^>]*disabled)/i);
  });
});
