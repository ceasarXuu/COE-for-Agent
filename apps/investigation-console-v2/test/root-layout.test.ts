import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { ThemeProvider } from '@coe/ui/theme-provider';

import { I18nProvider } from '../src/lib/i18n.js';
import { RootLayout } from '../src/routes/root-layout.js';

describe('root layout', () => {
  test('renders the GitHub entry and cases navigation inside the v2 shell', () => {
    const html = renderToStaticMarkup(
      createElement(ThemeProvider, {
        children: createElement(MemoryRouter, {
          initialEntries: ['/cases'],
          children: createElement(I18nProvider, {
            initialLocale: 'zh-CN',
            children: createElement(Routes, {
              children: createElement(Route, {
                element: createElement(RootLayout),
                children: createElement(Route, {
                  path: '/cases',
                  element: createElement('div', null, 'Cases')
                })
              })
            })
          })
        })
      })
    );

    expect(html).toContain('data-testid="layout-github-link"');
    expect(html).toContain('href="https://github.com/ceasarXuu/COE-for-Agent"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('Cases');
  });
});
