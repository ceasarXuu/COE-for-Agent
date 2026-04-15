import { useEffect, useState } from 'react';

import { useI18n } from '../lib/i18n.js';

export function RevisionSlider(props: {
  maxRevision: number;
  currentRevision: number;
  onChange: (revision: number) => void;
}) {
  const { t } = useI18n();
  const [draftRevision, setDraftRevision] = useState(props.currentRevision);

  useEffect(() => {
    setDraftRevision(props.currentRevision);
  }, [props.currentRevision]);

  const handleRevisionChange = (revisionValue: string) => {
    const revision = Number(revisionValue);
    setDraftRevision(revision);
    props.onChange(revision);
  };

  return (
    <label className="revision-field">
      <span>{t('revision.sync')}</span>
      <input
        data-testid="revision-slider"
        max={props.maxRevision}
        min={1}
        onChange={(event) => handleRevisionChange(event.currentTarget.value)}
        step={1}
        type="range"
        value={draftRevision}
      />
      <div className="revision-scale">
        <span>1</span>
        <span data-testid="revision-value">{draftRevision}</span>
        <span>{props.maxRevision}</span>
      </div>
    </label>
  );
}
