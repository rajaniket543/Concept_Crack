import { MetricTile } from '../../../mocks/student';

interface MetricCardProps {
  tile: MetricTile;
  /**
   * Visual variant. The dashboard's 4-up metrics use a flat card with a small
   * icon in the top-right; the analysis page uses a larger card with a value
   * and optional progress bar.
   */
  variant?: 'flat' | 'tall';
}

const TONE_ICON: Record<MetricTile['tone'], string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-on-tertiary-container',
  warning: 'text-on-surface-variant',
  muted: 'text-on-primary-container',
};

const TONE_DELTA: Record<MetricTile['tone'], string> = {
  primary: 'text-on-tertiary-container',
  secondary: 'text-secondary',
  tertiary: 'text-on-tertiary-container',
  warning: 'text-error',
  muted: 'text-on-surface-variant',
};

const TONE_PROGRESS: Record<MetricTile['tone'], string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-on-tertiary-container',
  warning: 'bg-error',
  muted: 'bg-primary',
};

export default function MetricCard({ tile, variant = 'flat' }: MetricCardProps) {
  if (variant === 'tall') {
    return (
      <div className="bg-surface-container-lowest p-card border border-outline-variant rounded-lg shadow-elev-1 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <span className="text-label-md uppercase tracking-widest text-on-surface-variant">
            {tile.label}
          </span>
          <span className={`material-symbols-outlined ${TONE_ICON[tile.tone]}`}>{tile.icon}</span>
        </div>
        <div>
          <h2 className="font-display-lg text-display-lg leading-none text-on-surface">
            {tile.value}
          </h2>
          {tile.delta && (
            <p className="text-body-md text-on-surface-variant mt-2">{tile.delta}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest p-card border border-outline-variant rounded-lg shadow-elev-1 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <span className="text-label-lg text-on-surface-variant">{tile.label}</span>
        <span className={`material-symbols-outlined ${TONE_ICON[tile.tone]}`}>{tile.icon}</span>
      </div>
      <div className="mt-4">
        <h2 className={`font-display-lg text-display-lg leading-none ${TONE_ICON[tile.tone]}`}>
          {tile.value}
        </h2>
        {tile.delta && (
          <p className={`flex items-center gap-1 mt-2 text-label-md ${TONE_DELTA[tile.tone]}`}>
            {tile.tone === 'primary' && <span className="material-symbols-outlined text-sm">trending_up</span>}
            {tile.delta}
          </p>
        )}
        {tile.progressPct !== undefined && (
          <div className="w-full bg-surface-container-high h-2 rounded-full mt-4 overflow-hidden">
            <div
              className={`h-full ${TONE_PROGRESS[tile.tone]}`}
              style={{ width: `${tile.progressPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
