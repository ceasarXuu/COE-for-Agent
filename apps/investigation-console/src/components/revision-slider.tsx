import { useI18n } from '../lib/i18n.js';

export function RevisionSlider(props: {
  maxRevision: number;
  currentRevision: number;
  onChange: (revision: number) => void;
}) {
  const { t } = useI18n();

  const handleRevisionChange = (revisionValue: string) => {
    props.onChange(Number(revisionValue));
  };

  return (
    <label className="revision-field">
      <span>{t('revision.sync')}</span>
      <input
        data-testid="revision-slider"
        max={props.maxRevision}
        min={1}
        onChange={(event) => handleRevisionChange(event.currentTarget.value)}
        onInput={(event) => handleRevisionChange((event.currentTarget as HTMLInputElement).value)}
        step={1}
        type="range"
        value={props.currentRevision}
      />
      <div className="revision-scale">
        <span>1</span>
        <span data-testid="revision-value">{props.currentRevision}</span>
        <span>{props.maxRevision}</span>
      </div>
    </label>
  );
}