interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  strokeColor: string;
  centerLabel: string;
  centerLabelClass?: string;
}

export default function CircularProgress({
  percent,
  size = 64,
  strokeWidth = 6,
  strokeColor,
  centerLabel,
  centerLabelClass = 'font-label-lg text-on-surface',
}: CircularProgressProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - percent / 100);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={r}
          stroke="#edeeef"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={r}
          stroke={strokeColor}
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </svg>
      <span className={`absolute ${centerLabelClass}`}>{centerLabel}</span>
    </div>
  );
}
