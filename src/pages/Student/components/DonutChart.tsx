interface DonutChartProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerLabelClass?: string;
  strokeColor?: string;
  trackColor?: string;
}

export default function DonutChart({
  percent,
  size = 128,
  strokeWidth = 8,
  centerLabel,
  centerLabelClass = 'font-headline-lg text-headline-lg text-primary',
  strokeColor = 'text-primary',
  trackColor = 'text-surface-container-high',
}: DonutChartProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - percent / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          className={trackColor}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={r}
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <circle
          className={strokeColor}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={r}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
        />
      </svg>
      {centerLabel && (
        <span className={`absolute ${centerLabelClass}`}>{centerLabel}</span>
      )}
    </div>
  );
}
