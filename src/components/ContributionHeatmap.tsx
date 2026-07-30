import { useMemo, useState } from 'react';
import type { DayActivity } from '../lib/studyCalendar';

// LeetCode-style contribution calendar: a header line of real totals, then 12
// month blocks (each a mini month laid out as week-columns × weekday-rows)
// separated by a gap, with the month name centred underneath. Colours follow
// the app's own theme rather than LeetCode's green.

// Sized so a full 12 months fits the dashboard card without horizontal
// scrolling (≈12 × (5 cols × 11px + 6px) ≈ 730px).
const CELL = 9;         // px, square side
const GAP = 2;          // px between squares
const MONTH_GAP = 6;    // px between month blocks
const MONTHS_SHOWN = 12;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function prettyDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

const LEVEL_ALPHA = [0, 0.3, 0.52, 0.76, 1];

interface Cell {
  date: string;
  level: number;
  activity: DayActivity | null;
  future: boolean;
}

interface MonthBlock {
  label: string;
  monthIndex: number;
  year: number;
  /** Week columns; each is 7 slots (weekday rows), null where the month has no day. */
  columns: Array<Array<Cell | null>>;
}

export default function ContributionHeatmap({
  data,
  colorBase = '#6B5EF0',
}: {
  data: Record<string, DayActivity>;
  colorBase?: string;
}) {
  const [hover, setHover] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);

  const { blocks, totalTests, activeDays, maxStreak } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Intensity, active-days and streak all key off tests submitted — the same
    // thing the headline number counts — so the squares, the totals and the
    // streak can never disagree with each other. (Questions answered and study
    // time still show in the tooltip and day summary; they just don't drive
    // the colour, so one square always means "a day you submitted a test".)
    const maxTests = Math.max(1, ...Object.values(data).map(d => d.tests));
    const levelFor = (tests: number) => {
      if (tests <= 0) return 0;
      const ratio = tests / maxTests;
      return ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
    };

    // Oldest visible month is 11 months before the current one.
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - (MONTHS_SHOWN - 1), 1);

    const out: MonthBlock[] = [];
    let tests = 0, active = 0, streak = 0, best = 0;

    for (let m = 0; m < MONTHS_SHOWN; m += 1) {
      const monthStart = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + m, 1);
      const year = monthStart.getFullYear();
      const monthIndex = monthStart.getMonth();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const offset = monthStart.getDay(); // Sunday-first rows, as LeetCode renders

      const colCount = Math.ceil((daysInMonth + offset) / 7);
      const columns: Array<Array<Cell | null>> = Array.from({ length: colCount }, () => Array(7).fill(null));

      for (let d = 1; d <= daysInMonth; d += 1) {
        const date = new Date(year, monthIndex, d);
        const slot = offset + d - 1;
        const col = Math.floor(slot / 7);
        const row = slot % 7;
        const key = dayKey(date);
        const future = date > today;
        const activity = future ? null : (data[key] ?? null);
        const dayTests = activity?.tests ?? 0;

        columns[col][row] = { date: key, level: future ? 0 : levelFor(dayTests), activity, future };

        if (!future) {
          tests += dayTests;
          if (dayTests > 0) { active += 1; streak += 1; best = Math.max(best, streak); }
          else streak = 0;
        }
      }

      out.push({ label: MONTHS[monthIndex], monthIndex, year, columns });
    }

    return { blocks: out, totalTests: tests, activeDays: active, maxStreak: best };
  }, [data]);

  function cellColor(cell: Cell): string {
    if (cell.future) return 'transparent';
    if (cell.level === 0) return 'var(--surface-muted)';
    return hexToRgba(colorBase, LEVEL_ALPHA[cell.level]);
  }

  return (
    <div className="w-full">
      {/* Header — real totals, LeetCode's summary line */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <div className="text-body-md" style={{ color: 'var(--text-secondary)' }}>
          <span className="text-headline-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {totalTests}
          </span>{' '}
          test{totalTests === 1 ? '' : 's'} in the past one year
        </div>
        <div className="flex items-center gap-5 text-body-sm" style={{ color: 'var(--text-muted)' }}>
          <span>Total active days: <strong style={{ color: 'var(--text-primary)' }}>{activeDays}</strong></span>
          <span>Max streak: <strong style={{ color: 'var(--text-primary)' }}>{maxStreak}</strong></span>
        </div>
      </div>

      {/* Grid — month blocks separated by a gap, labels underneath */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="relative inline-block" data-heatmap-host>
          <div style={{ display: 'flex', gap: MONTH_GAP }}>
            {blocks.map(block => (
              <div key={`${block.year}-${block.monthIndex}`} className="flex flex-col">
                <div style={{ display: 'flex', gap: GAP }}>
                  {block.columns.map((col, ci) => (
                    <div key={ci} style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP }}>
                      {col.map((cell, ri) => {
                        if (!cell) return <div key={ri} style={{ width: CELL, height: CELL }} />;
                        const isSelected = selected?.date === cell.date;
                        const isHovered = hover?.cell.date === cell.date;
                        return (
                          <div
                            key={ri}
                            onMouseEnter={e => {
                              if (cell.future) return;
                              const el = e.currentTarget as HTMLElement;
                              const host = el.closest('[data-heatmap-host]');
                              if (!host) return;
                              const r = el.getBoundingClientRect();
                              const h = host.getBoundingClientRect();
                              setHover({ cell, x: r.left - h.left + CELL / 2, y: r.top - h.top });
                            }}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => !cell.future && setSelected(isSelected ? null : cell)}
                            role={cell.future ? undefined : 'button'}
                            aria-label={cell.future ? undefined : `${prettyDate(cell.date)} — ${formatMinutes(cell.activity?.minutes ?? 0)} studied`}
                            style={{
                              width: CELL, height: CELL, borderRadius: 2.5,
                              backgroundColor: cellColor(cell),
                              outline: isSelected ? `2px solid ${colorBase}` : 'none',
                              outlineOffset: 1,
                              cursor: cell.future ? 'default' : 'pointer',
                              transition: 'transform 130ms ease, background-color 130ms ease',
                              transform: isHovered ? 'scale(1.4)' : 'scale(1)',
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Month label, centred under its block */}
                <div className="text-center text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  {block.label}
                </div>
              </div>
            ))}
          </div>

          {/* Hover tooltip */}
          {hover && (
            <div
              className="absolute z-20 pointer-events-none rounded-lg px-3 py-2 shadow-lg"
              style={{
                left: hover.x,
                top: hover.y - 8,
                transform: 'translate(-50%, -100%)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}
            >
              <div className="text-[11px] font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {prettyDate(hover.cell.date)}
              </div>
              <div className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <div>{hover.cell.activity?.tests ?? 0} test{(hover.cell.activity?.tests ?? 0) === 1 ? '' : 's'}</div>
                <div>{hover.cell.activity?.solved ?? 0} question{(hover.cell.activity?.solved ?? 0) === 1 ? '' : 's'} answered</div>
                <div>{formatMinutes(hover.cell.activity?.minutes ?? 0)} studied</div>
                <div>
                  {hover.cell.activity?.accuracyPct != null
                    ? `${hover.cell.activity.accuracyPct}% accuracy`
                    : 'No test attempted'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click-to-open day summary */}
      {selected && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-body-md font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {prettyDate(selected.date)}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="icon-btn icon-btn-sm shrink-0"
              aria-label="Close day summary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
          {selected.activity && (selected.activity.minutes > 0 || selected.activity.solved > 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Questions answered', value: String(selected.activity.solved), color: colorBase },
                { label: 'Study time',       value: formatMinutes(selected.activity.minutes), color: '#F59E0B' },
                { label: 'Accuracy',         value: selected.activity.accuracyPct != null ? `${selected.activity.accuracyPct}%` : '—', color: '#10B981' },
                { label: 'Tests submitted',  value: String(selected.activity.tests), color: '#8B5CF6' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-lg font-bold font-headline" style={{ color: s.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</div>
                  <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No study activity recorded on this day.</p>
          )}
        </div>
      )}
    </div>
  );
}
