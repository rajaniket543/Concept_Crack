import { WeeklyDay } from '../../../mocks/student';

interface WeeklyBarChartProps {
  data: WeeklyDay[];
  /**
   * "primary" (dashboard) renders the bars in deep blue with a top border accent
   * on Thu/Fri/Sun. Matches the static mock.
   */
  variant?: 'primary';
}

export default function WeeklyBarChart({ data, variant = 'primary' }: WeeklyBarChartProps) {
  if (variant === 'primary') {
    const peak = new Set(['Thu', 'Fri', 'Sun']);
    return (
      <div className="h-64 flex items-end justify-between gap-2 px-2">
        {data.map((d) => (
          <div
            key={d.day}
            className="flex-1 bg-primary/10 rounded-t-lg relative group"
            style={{ height: `${d.percent}%` }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded transition-all whitespace-nowrap">
              {d.percent}%
            </div>
            <div
              className={`w-full h-full rounded-t-lg bg-gradient-to-t from-primary/20 ${
                peak.has(d.day) ? 'to-primary/40 border-t-2 border-primary' : 'to-primary/40'
              }`}
            />
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-on-surface-variant">
              {d.day}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
