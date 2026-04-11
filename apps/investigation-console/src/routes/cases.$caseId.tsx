import { startTransition, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { GraphCanvas } from '../components/graph/GraphCanvas.js';
import { TimelineView } from '../components/timeline-view.js';
import { connectConsoleStream } from '../lib/sse.js';
import {
  getCaseGraph,
  getCaseSnapshot,
  getCaseTimeline,
  type CaseGraphEnvelope,
  type CaseSnapshotEnvelope,
  type CaseTimelineEnvelope
} from '../lib/api.js';
import { useI18n } from '../lib/i18n.js';
import { resetUIState, setRevision } from '../store/ui-store.js';

interface WorkspaceData {
  snapshot: CaseSnapshotEnvelope;
  timeline: CaseTimelineEnvelope;
  graph: CaseGraphEnvelope;
}

export function CaseWorkspaceRoute() {
  const { formatEnumLabel, t } = useI18n();
  const params = useParams();
  const caseId = params.caseId ?? '';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const revision = useMemo(() => {
    const rawValue = searchParams.get('revision');
    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const requestRefresh = useEffectEvent(() => {
    setRefreshNonce((value) => value + 1);
  });

  useEffect(() => {
    setRevision(revision);
  }, [revision]);

  useEffect(() => {
    resetUIState();
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getCaseSnapshot(caseId, revision),
      getCaseTimeline(caseId, revision),
      getCaseGraph(caseId, { revision })
    ])
      .then(([snapshot, timeline, graph]) => ({ snapshot, timeline, graph }))
      .then((data) => {
        if (!cancelled) {
          startTransition(() => {
            setWorkspace(data);
          });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t('errors.loadWorkspace'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, refreshNonce, revision, t]);

  useEffect(() => {
    if (revision !== null) {
      return;
    }

    return connectConsoleStream({
      onHeadRevisionChanged: (event) => {
        if (event.caseId === caseId) {
          requestRefresh();
        }
      },
      onProjectionUpdated: (event) => {
        if (event.caseId === caseId) {
          requestRefresh();
        }
      }
    });
  }, [caseId, requestRefresh, revision]);

  const maxRevision = workspace?.snapshot.headRevision ?? 1;
  const currentRevision = revision ?? maxRevision;
  const listSearchParams = new URLSearchParams(searchParams);
  listSearchParams.delete('revision');
  const listSearch = listSearchParams.toString();

  return (
    <section className="workspace-shell">
      <header className="workspace-toolbar">
        <div className="workspace-header-copy">
          <Link
            className="ghost-link"
            to={{
              pathname: '/cases',
              search: listSearch ? `?${listSearch}` : ''
            }}
          >
            {t('workspace.back')}
          </Link>
          <div className="workspace-title-row">
            <h2>{workspace?.snapshot.data.case?.title ?? caseId}</h2>
            {workspace?.snapshot.data.case?.severity ? (
              <span className={`pill pill-${(workspace.snapshot.data.case.severity ?? 'medium').toLowerCase()}`}>
                {formatEnumLabel(workspace.snapshot.data.case.severity)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="workspace-grid">
        <section className="workspace-main">
          {loading && !workspace ? <section className="panel graph-stage"><p>{t('workspace.replaying')}</p></section> : null}
          {workspace ? (
            <GraphCanvas
              snapshot={workspace.snapshot}
              graph={workspace.graph}
              onSelectNode={() => undefined}
            />
          ) : null}
        </section>

        <aside className="workspace-rail workspace-rail-side">
          {workspace ? (
            <TimelineView
              timeline={workspace.timeline}
              revisionControls={{
                currentRevision,
                maxRevision,
                onChange: (nextRevision) => {
                  const nextParams = new URLSearchParams(searchParams);
                  if (nextRevision >= maxRevision) {
                    nextParams.delete('revision');
                  } else {
                    nextParams.set('revision', String(nextRevision));
                  }

                  startTransition(() => {
                    navigate({
                      pathname: `/cases/${caseId}`,
                      search: nextParams.toString() ? `?${nextParams.toString()}` : ''
                    });
                  });
                }
              }}
            />
          ) : null}
        </aside>

      </div>
    </section>
  );
}
