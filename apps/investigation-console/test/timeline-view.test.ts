import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { TimelineView } from '../src/components/timeline-view.js';
import { I18nProvider } from '../src/lib/i18n.js';

describe('timeline view', () => {
  test('renders revision sync controls inside the timeline module', () => {
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
                  eventType: 'fact.asserted',
                  caseRevision: 3,
                  occurredAt: '2026-04-11T00:00:00.000Z',
                  summary: 'recorded the queue spike fact'
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

    expect(html).toContain('时间线');
    expect(html).toContain('修订同步');
    expect(html).toContain('data-testid="revision-slider"');
  });

  test('hides revision sync controls when fewer than two revisions exist', () => {
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
                  eventType: 'case.opened',
                  caseRevision: 1,
                  occurredAt: '2026-04-11T00:00:00.000Z',
                  summary: 'case opened'
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

    expect(html).toContain('时间线');
    expect(html).not.toContain('修订同步');
    expect(html).not.toContain('data-testid="revision-slider"');
  });
});
