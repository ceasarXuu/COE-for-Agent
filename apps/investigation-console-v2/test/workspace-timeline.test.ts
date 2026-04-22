import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, test } from 'vitest';

import { I18nProvider } from '../src/lib/i18n.js';
import { WorkspaceTimeline } from '../src/components/workspace/workspace-timeline.js';

function renderTimeline(props: {
  currentRevision: number;
  maxRevision: number;
  onChange: (revision: number) => void;
  timeline: {
    data: {
      events: Array<{
        eventId: string;
        eventType: string;
        caseRevision: number;
        occurredAt: string;
        editorOrigin?: 'agent' | 'web_ui';
        summary: string;
      }>;
    };
  };
}) {
  return renderToStaticMarkup(
    createElement(I18nProvider, {
      initialLocale: 'zh-CN',
      children: createElement(WorkspaceTimeline, props as never)
    })
  );
}

describe('v2 workspace timeline', () => {
  test('renders revision markers for every available revision on the rail', () => {
    const html = renderTimeline({
      currentRevision: 3,
      maxRevision: 3,
      onChange() {
        return;
      },
      timeline: {
        data: {
          events: [
            {
              eventId: 'evt-1',
              eventType: 'case.opened',
              caseRevision: 1,
              occurredAt: '2026-04-19T18:00:00.000Z',
              editorOrigin: 'web_ui',
              summary: 'case.opened'
            },
            {
              eventId: 'evt-2',
              eventType: 'canonical.hypothesis.created',
              caseRevision: 2,
              occurredAt: '2026-04-19T18:01:00.000Z',
              editorOrigin: 'agent',
              summary: 'canonical.hypothesis.created'
            },
            {
              eventId: 'evt-3',
              eventType: 'canonical.hypothesis.updated',
              caseRevision: 3,
              occurredAt: '2026-04-19T18:02:00.000Z',
              editorOrigin: 'web_ui',
              summary: 'canonical.hypothesis.updated'
            }
          ]
        }
      }
    });

    expect(html).toContain('data-testid="revision-marker-slot-1"');
    expect(html).toContain('data-testid="revision-marker-slot-2"');
    expect(html).toContain('data-testid="revision-marker-slot-3"');
    expect(html).toContain('left:0%');
    expect(html).toContain('left:50%');
    expect(html).toContain('left:100%');
  });

  test('renders hover bubble content for revisions with events', () => {
    const html = renderTimeline({
      currentRevision: 2,
      maxRevision: 2,
      onChange() {
        return;
      },
      timeline: {
        data: {
          events: [
            {
              eventId: 'evt-1',
              eventType: 'case.opened',
              caseRevision: 1,
              occurredAt: '2026-04-19T18:00:00.000Z',
              editorOrigin: 'web_ui',
              summary: '案件已创建'
            },
            {
              eventId: 'evt-2',
              eventType: 'canonical.hypothesis.updated',
              caseRevision: 2,
              occurredAt: '2026-04-19T18:02:00.000Z',
              editorOrigin: 'agent',
              summary: '假设已更新'
            }
          ]
        }
      }
    });

    expect(html).toContain('data-testid="revision-bubble-1"');
    expect(html).toContain('data-testid="revision-bubble-2"');
    expect(html).toContain('案件已创建');
    expect(html).toContain('假设已更新');
  });
});
