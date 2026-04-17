import { useMemo, useState } from 'react';

import { useI18n } from '../../lib/i18n.js';

type CanonicalChildKind = 'hypothesis' | 'blocker' | 'repair_attempt' | 'evidence_ref';

export interface CanonicalCreateSubmission {
  childKind: CanonicalChildKind;
  changeSummary?: string;
  description?: string;
  effectOnParent?: 'supports' | 'refutes' | 'neutral' | 'validates' | 'invalidates';
  falsificationCriteria?: string[];
  interpretation?: string;
  possibleWorkarounds?: string[];
  provenance?: string;
  scope?: string;
  statement?: string;
  summary?: string;
  title?: string;
}

export function CanonicalGraphCreatePopover(props: {
  allowedKinds: CanonicalChildKind[];
  parentKind: string;
  pending: boolean;
  position: { left: number; top: number };
  onCancel: () => void;
  onSubmit: (submission: CanonicalCreateSubmission) => void;
}) {
  const { t } = useI18n();
  const [selectedKind, setSelectedKind] = useState<CanonicalChildKind | null>(null);
  const [primaryText, setPrimaryText] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [effectOnParent, setEffectOnParent] = useState<'supports' | 'refutes' | 'neutral' | 'validates' | 'invalidates'>(
    props.parentKind === 'repair_attempt' ? 'validates' : 'supports'
  );

  const effectOptions = useMemo(() => {
    return props.parentKind === 'repair_attempt'
      ? ['validates', 'invalidates', 'neutral']
      : ['supports', 'refutes', 'neutral'];
  }, [props.parentKind]);

  return (
    <div
      className="context-menu"
      style={{
        left: props.position.left,
        position: 'absolute',
        top: props.position.top,
        zIndex: 1000
      }}
    >
      <div className="context-menu-header">Create Child Node</div>

      {!selectedKind ? (
        props.allowedKinds.map((kind) => (
          <div
            key={kind}
            className="context-menu-item"
            onClick={() => setSelectedKind(kind)}
          >
            {labelForKind(kind, t)}
          </div>
        ))
      ) : (
        <div className="graph-create-form">
          <p className="panel-kicker">{labelForKind(selectedKind, t)}</p>

          {selectedKind === 'hypothesis' ? (
            <>
              <label className="search-field">
                <span>Hypothesis</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setPrimaryText(event.currentTarget.value)}
                  rows={3}
                  value={primaryText}
                />
              </label>
              <label className="search-field">
                <span>Falsification Criteria</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setSecondaryText(event.currentTarget.value)}
                  rows={2}
                  value={secondaryText}
                />
              </label>
            </>
          ) : null}

          {selectedKind === 'blocker' ? (
            <>
              <label className="search-field">
                <span>Blocker</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setPrimaryText(event.currentTarget.value)}
                  rows={3}
                  value={primaryText}
                />
              </label>
              <label className="search-field">
                <span>Possible Workarounds</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setSecondaryText(event.currentTarget.value)}
                  rows={2}
                  value={secondaryText}
                />
              </label>
            </>
          ) : null}

          {selectedKind === 'repair_attempt' ? (
            <>
              <label className="search-field">
                <span>Change Summary</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setPrimaryText(event.currentTarget.value)}
                  rows={3}
                  value={primaryText}
                />
              </label>
              <label className="search-field">
                <span>Scope</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setSecondaryText(event.currentTarget.value)}
                  rows={2}
                  value={secondaryText}
                />
              </label>
            </>
          ) : null}

          {selectedKind === 'evidence_ref' ? (
            <>
              <label className="search-field">
                <span>Evidence Title</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setPrimaryText(event.currentTarget.value)}
                  rows={2}
                  value={primaryText}
                />
              </label>
              <label className="search-field">
                <span>Summary</span>
                <textarea
                  disabled={props.pending}
                  onChange={(event) => setSecondaryText(event.currentTarget.value)}
                  rows={2}
                  value={secondaryText}
                />
              </label>
              <label className="search-field">
                <span>Effect</span>
                <select
                  disabled={props.pending}
                  onChange={(event) => setEffectOnParent(event.currentTarget.value as typeof effectOnParent)}
                  value={effectOnParent}
                >
                  {effectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <div className="confirm-actions">
            <button
              className="action-button"
              disabled={props.pending || primaryText.trim().length === 0}
              onClick={() => props.onSubmit(buildSubmission(selectedKind, primaryText, secondaryText, effectOnParent))}
              type="button"
            >
              Create
            </button>
            <button className="ghost-button" onClick={props.onCancel} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildSubmission(
  childKind: CanonicalChildKind,
  primaryText: string,
  secondaryText: string,
  effectOnParent: 'supports' | 'refutes' | 'neutral' | 'validates' | 'invalidates'
): CanonicalCreateSubmission {
  switch (childKind) {
    case 'hypothesis':
      return {
        childKind,
        statement: primaryText.trim(),
        falsificationCriteria: splitLines(secondaryText)
      };
    case 'blocker':
      return {
        childKind,
        description: primaryText.trim(),
        possibleWorkarounds: splitLines(secondaryText)
      };
    case 'repair_attempt':
      return {
        childKind,
        changeSummary: primaryText.trim(),
        scope: secondaryText.trim()
      };
    case 'evidence_ref':
      return {
        childKind,
        title: primaryText.trim(),
        summary: secondaryText.trim(),
        provenance: 'manual://graph-canvas',
        effectOnParent,
        interpretation: secondaryText.trim() || primaryText.trim()
      };
  }
}

function labelForKind(kind: CanonicalChildKind, t: (key: string) => string) {
  switch (kind) {
    case 'hypothesis':
      return t('graph.node.hypothesis');
    case 'blocker':
      return t('graph.node.blocker');
    case 'repair_attempt':
      return t('graph.node.repair_attempt');
    case 'evidence_ref':
      return t('graph.node.evidence_ref');
  }
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
