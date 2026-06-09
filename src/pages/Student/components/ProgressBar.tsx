interface ProgressBarProps {
  percent: number;
  barClass: string;
  trackClass?: string;
  heightClass?: string;
  label?: string;
  trailing?: string;
  /**
   * If true, the label is rendered above the bar (subject/difficulty rows);
   * otherwise the bar is rendered alone inside a fixed-height track.
   */
  withLabel?: boolean;
}

export default function ProgressBar({
  percent,
  barClass,
  trackClass = 'bg-surface-container-high',
  heightClass = 'h-2',
  label,
  trailing,
  withLabel = true,
}: ProgressBarProps) {
  return (
    <div>
      {withLabel && (label || trailing) && (
        <div className="flex justify-between text-label-md font-label-lg mb-1">
          {label && <span>{label}</span>}
          {trailing && <span>{trailing}</span>}
        </div>
      )}
      <div className={`w-full ${heightClass} ${trackClass} rounded-full overflow-hidden`}>
        <div className={`h-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
