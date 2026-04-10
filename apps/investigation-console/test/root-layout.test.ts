import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { I18nProvider } from '../src/lib/i18n.js';
import { RootLayout } from '../src/routes/__root.js';

describe('root layout', () => {
  test('renders a GitHub entry beside the console title that opens the project homepage in a new tab', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {
        children: createElement(I18nProvider, {
          initialLocale: 'zh-CN',
          children: createElement(RootLayout)
        })
      })
    );

    expect(html).toContain('data-testid="layout-github-link"');
    expect(html).toContain('href="https://github.com/ceasarXuu/COE-for-Agent"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
  });
});
