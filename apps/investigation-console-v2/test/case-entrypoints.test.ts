import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { describe, expect, test } from 'vitest';

import { CaseGallery } from '../src/components/case-gallery.js';
import type { CaseListItem } from '../src/lib/api.js';
import { I18nProvider } from '../src/lib/i18n.js';

function renderCaseGallery(items: CaseListItem[]) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {
      children: createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(CaseGallery, {
          items,
          onCreateRequest() {
            return;
          }
        })
      })
    })
  );
}

describe('v2 case entrypoints', () => {
  test('does not render a dedicated create card when case items exist', () => {
    const html = renderCaseGallery([
      {
        caseId: 'case_01',
        title: 'Example',
        summary: 'Summary',
        severity: 'high',
        status: 'active',
        headRevision: 3,
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    ]);

    expect(html).not.toContain('data-testid="case-create-card"');
    expect(html).not.toContain('新建 case');
    expect(html).toContain('data-testid="case-card-case_01"');
  });

  test('adds a toolbar create button in the cases page source', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../src/routes/cases-page.tsx'),
      'utf8'
    );

    expect(source).toContain('data-testid="cases-toolbar-create"');
    expect(source).not.toContain('caseList.stage');
    expect(source).not.toContain('formatEnumLabel(item.stage');
  });
});
