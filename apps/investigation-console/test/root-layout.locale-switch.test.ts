import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { I18nProvider } from '../src/lib/i18n.js';
import { RootLayout } from '../src/routes/__root.js';

describe('root layout locale switcher', () => {
  test('renders a locale toggle beside the header actions', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {
        children: createElement(I18nProvider, {
          initialLocale: 'en',
          children: createElement(RootLayout)
        })
      })
    );

    expect(html).toContain('data-testid="layout-locale-en"');
    expect(html).toContain('data-testid="layout-locale-zh-CN"');
    expect(html).toContain('aria-label="Language"');
  });

  test('marks the active locale button as pressed in Chinese mode', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {
        children: createElement(I18nProvider, {
          initialLocale: 'zh-CN',
          children: createElement(RootLayout)
        })
      })
    );

    expect(html).toContain('data-testid="layout-locale-zh-CN"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('切换到英文');
  });
});
