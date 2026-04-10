import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { CaseList } from '../src/components/case-list.js';
import { I18nProvider } from '../src/lib/i18n.js';

describe('case list', () => {
  test('does not render the manual intake kicker on the create card', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {
        children: createElement(I18nProvider, {
          initialLocale: 'zh-CN',
          children: createElement(CaseList, {
            items: [],
            onCreateRequest() {
              return;
            }
          })
        })
      })
    );

    expect(html).toContain('新建 case');
    expect(html).not.toContain('手动受理');
  });
});
