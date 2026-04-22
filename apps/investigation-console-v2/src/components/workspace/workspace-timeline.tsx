import { Slider } from '@coe/ui/components/slider';

import { useI18n } from '@/lib/i18n.js';

export function WorkspaceTimeline(props: {
  currentRevision: number;
  maxRevision: number;
  onChange: (revision: number) => void;
}) {
  const { t } = useI18n();

  if (props.maxRevision < 2) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card/70 px-4 py-3 md:px-5">
      <div className="mb-3 text-sm font-medium">{t('timeline.kicker')}</div>
      <Slider
        aria-label="Revision slider"
        max={props.maxRevision}
        min={1}
        step={1}
        value={[props.currentRevision]}
        onValueChange={(values) => {
          const nextValue = values[0];
          if (typeof nextValue === 'number' && nextValue !== props.currentRevision) {
            props.onChange(nextValue);
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>1</span>
        <span>{props.maxRevision}</span>
      </div>
    </section>
  );
}
