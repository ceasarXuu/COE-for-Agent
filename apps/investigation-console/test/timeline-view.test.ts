import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { TimelineView } from '../src/components/timeline-view.js';
import { I18nProvider } from '../src/lib/i18n.js';

describe('timeline view', () => {
  test('renders only the timeline label and revision slider in the top strip while keeping revision bubbles on the markers', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(TimelineView, {
          timeline: {
            headRevision: 3,
            projectionRevision: 3,
            requestedRevision: null,
            stale: false,
            historical: false,
            data: {
              events: [
                {
                  eventId: 'event_01',
                  eventType: 'canonical.evidence.attached',
                  caseRevision: 3,
                  occurredAt: '2026-04-11T00:00:00.000Z',
                  summary: '已将回放证据关联到当前分支'
                }
              ]
            }
          },
          revisionControls: {
            currentRevision: 3,
            maxRevision: 3,
            onChange() {
              return;
            }
          }
        })
      })
    );

    expect(html).toContain('timeline-strip');
    expect(html).toContain('时间线');
    expect(html).toContain('data-testid="revision-slider"');
    expect(html).toContain('data-testid="revision-marker-1"');
    expect(html).toContain('data-testid="revision-marker-2"');
    expect(html).toContain('data-testid="revision-marker-3"');
    expect(html).not.toContain('timeline-strip-event');
    expect(html).toContain('data-testid="revision-bubble-3"');
    expect(html).toContain('证据已关联');
  });

  test('hides the slider when fewer than two revisions exist and keeps the strip minimal', () => {
    const html = renderToStaticMarkup(
      createElement(I18nProvider, {
        initialLocale: 'zh-CN',
        children: createElement(TimelineView, {
          timeline: {
            headRevision: 1,
            projectionRevision: 1,
            requestedRevision: null,
            stale: false,
            historical: false,
            data: {
              events: [
                {
                  eventId: 'event_01',
                  eventType: 'problem.updated',
                  caseRevision: 1,
                  occurredAt: '2026-04-11T00:00:00.000Z',
                  summary: '问题上下文已更新'
                }
              ]
            }
          },
          revisionControls: {
            currentRevision: 1,
            maxRevision: 1,
            onChange() {
              return;
            }
          }
        })
      })
    );

    expect(html).toContain('timeline-strip');
    expect(html).toContain('时间线');
    expect(html).not.toContain('data-testid="revision-slider"');
    expect(html).not.toContain('timeline-strip-event');
    expect(html).not.toContain('data-testid="revision-bubble-1"');
  });
});
