import { readFileSync } from 'node:fs';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { CreateCasePanel } from '../src/components/create-case-panel.js';
import { I18nProvider } from '../src/lib/i18n.js';

describe('create case panel', () => {
  test('does not render the intake sidecar explainer copy in the create form', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(CreateCasePanel, {
          error: null,
          open: true,
          pending: false,
          onClose() {
            return;
          },
          async onSubmit() {
            return;
          }
        })
      })
    );

    expect(html).not.toContain('首个修订');
    expect(html).not.toContain('新 case 会以 intake 阶段创建，并自动带上默认 inquiry，方便立即进入工作台。');
    expect(html).not.toContain('手动受理');
    expect(html).not.toContain('用一条完整但轻量的受理信息开启新调查，让工作台一进来就有上下文。');
    expect(html).not.toContain('case-form-callout');
  });

  test('keeps the header close button from shrinking into wrapped text', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(CreateCasePanel, {
          error: null,
          open: true,
          pending: false,
          onClose() {
            return;
          },
          async onSubmit() {
            return;
          }
        })
      })
    );
    const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');

    expect(html).toContain('case-create-panel-close');
    expect(css).toContain('.case-create-panel-close');
    expect(css).toContain('flex-shrink: 0;');
    expect(css).toContain('white-space: nowrap;');
  });

  test('replaces environment with a required project directory field', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(CreateCasePanel, {
          error: null,
          open: true,
          pending: false,
          onClose() {
            return;
          },
          async onSubmit() {
            return;
          }
        })
      })
    );

    expect(html).toContain('项目目录');
    expect(html).toContain('data-testid="create-case-project-directory"');
    expect(html).toContain('placeholder="/workspace/customer-a"');
    expect(html).toContain('required=""');
    expect(html).not.toContain('create-case-environment');
    expect(html).not.toContain('多个环境用逗号分隔');
  });
});
