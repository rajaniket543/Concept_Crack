import { useLayoutEffect, useMemo, useRef, useState } from 'react';

// A compact GitHub / LeetCode-style contribution calendar: 7 day-rows × N week
// columns of small rounded squares, shaded by how much activity happened that
// day. Reused across Admin, Student, Faculty and Parent dashboards.
//
// The week count fills whatever width its parent card gives it (measured via
// ResizeObserver) rather than a fixed column count — otherwise the grid renders
// at a fixed intrinsic width and leaves a dead gap next to it inside wider cards.

interface ActivityHeatmapProps {
  /** Map of 'YYYY-MM-DD' → activity count for that day. */
  data: Record<string, number>;
  /** Force an exact week count instead of auto-filling the container width. */
  weeks?: number;
  /** Base colour for the "active" squares (default emerald, LeetCode-style). */
  colorBase?: string;
  /** Word used in tooltips, e.g. "submission", "test", "session". */
  unit?: string;
}

const CELL = 16; // px, square side
const GAP = 4;   // px
const DAY_LABEL_WIDTH = 30; // px, left gutter for Mon/Wed/Fri labels
const MIN_WEEKS = 8;
const MAX_WEEKS = 53; // a full year

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// GitHub labels only Mon / Wed / Fri to keep the left gutter light.
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Cell { date: Date; key: string; count: number; future: boolean }

export default function ActivityHeatmap({ data, weeks, colorBase = '#10B981', unit = 'activity' }: ActivityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-fill the measured container width with as many week-columns as fit,
  // instead of always rendering a fixed 26 columns regardless of card size.
  const computedWeeks = useMemo(() => {
    if (weeks) return weeks;
    if (containerWidth <= 0) return 26; // sane default before first measurement
    const usable = containerWidth - DAY_LABEL_WIDTH - GAP;
    const fit = Math.floor(usable / (CELL + GAP));
    return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, fit));
  }, [containerWidth, weeks]);

  const { columns, max, total, activeDays } = useMemo(() => {
    const weeks = computedWeeks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Oldest visible day: go back (weeks*7 - 1) days, then align to the week's Sunday.
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7 - 1));
    start.setDate(start.getDate() - start.getDay());

    const cols: Cell[][] = [];
    let max = 0, total = 0, activeDays = 0;
    const cursor = new Date(start);
    for (let w = 0; w < weeks; w += 1) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d += 1) {
        const key = dayKey(cursor);
        const future = cursor > today;
        const count = future ? 0 : (data[key] ?? 0);
        if (count > 0) { total += count; activeDays += 1; }
        if (count > max) max = count;
        col.push({ date: new Date(cursor), key, count, future });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return { columns: cols, max, total, activeDays };
  }, [data, computedWeeks]);

  function cellColor(cell: Cell): string {
    if (cell.future) return 'transparent';
    if (cell.count <= 0) return 'var(--surface-muted)';
    const ratio = max > 0 ? cell.count / max : 0;
    const alpha = ratio > 0.75 ? 1 : ratio > 0.5 ? 0.72 : ratio > 0.25 ? 0.48 : 0.28;
    return hexToRgba(colorBase, alpha);
  }

  // Month labels: show a label above the first column whose first day starts a new month.
  const monthLabels = columns.map((col, i) => {
    const firstOfMonth = col.find(c => c.date.getDate() <= 7);
    if (!firstOfMonth) return null;
    const prev = i > 0 ? columns[i - 1].find(c => c.date.getDate() <= 7)?.date.getMonth() : -1;
    if (i === 0 || firstOfMonth.date.getMonth() !== prev) return { i, label: MONTHS[firstOfMonth.date.getMonth()] };
    return null;
  }).filter(Boolean) as { i: number; label: string }[];

  return (
    <div ref={containerRef} className="w-full overflow-x-auto flex justify-center">
      <div style={{ display: 'inline-block' }}>
        {/* Month labels */}
        <div style={{ display: 'grid', gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${columns.length}, ${CELL}px)`, gap: GAP, marginBottom: 6 }}>
          <div />
          {columns.map((_, i) => {
            const m = monthLabels.find(l => l.i === i);
            return (
              <div key={i} className="text-[10px]" style={{ color: 'var(--text-faint)', height: 14, whiteSpace: 'nowrap' }}>
                {m ? m.label : ''}
              </div>
            );
          })}
        </div>

        {/* Grid: left day labels + 7 rows */}
        <div style={{ display: 'flex', gap: GAP }}>
          {/* Day labels column */}
          <div style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP, width: DAY_LABEL_WIDTH }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-[9px] flex items-center" style={{ color: 'var(--text-faint)', height: CELL }}>{d}</div>
            ))}
          </div>

          {/* Week columns */}
          <div style={{ display: 'flex', gap: GAP }}>
            {columns.map((col, ci) => (
              <div key={ci} style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP }}>
                {col.map((cell, ri) => (
                  <div
                    key={ri}
                    title={cell.future ? '' : `${cell.count} ${unit}${cell.count === 1 ? '' : 's'} · ${cell.date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      backgroundColor: cellColor(cell),
                      border: cell.future ? 'none' : '1px solid rgba(0,0,0,0.03)',
                      outline: cell.count > 0 ? `1px solid ${hexToRgba(colorBase, 0.15)}` : 'none',
                      outlineOffset: -1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer: total + legend */}
        <div className="flex items-center justify-between mt-3" style={{ paddingLeft: DAY_LABEL_WIDTH + GAP }}>
          <span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>
            {total} {unit}{total === 1 ? '' : 's'} over {activeDays} active day{activeDays === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Less</span>
            {[0, 0.28, 0.48, 0.72, 1].map((a, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: a === 0 ? 'var(--surface-muted)' : hexToRgba(colorBase, a) }} />
            ))}
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
