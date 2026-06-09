import { LeaderRow } from '../../../mocks/student';

interface RankTableProps {
  title: string;
  subtitle: string;
  rows: LeaderRow[];
  variant: 'points' | 'accuracy';
  /**
   * Filter by metric when rendering. The two tables in the leaderboard both
   * pass a `value` of `points` or `accuracy` to compute the right-aligned cell.
   */
}

const HIGHLIGHT_BADGE: Record<NonNullable<LeaderRow['highlight']>, string> = {
  gold: 'bg-yellow-100 text-yellow-700',
  silver: 'bg-slate-100 text-slate-700',
  bronze: 'bg-amber-700/80 text-white',
  none: 'bg-surface-container-highest text-on-surface-variant',
};

export default function RankTable({ title, subtitle, rows, variant }: RankTableProps) {
  const valueFor = (r: LeaderRow): string => {
    if (variant === 'points') {
      return r.points !== undefined ? r.points.toLocaleString() : '—';
    }
    return r.accuracy !== undefined ? `${r.accuracy.toFixed(1)}%` : '—';
  };

  const trailingFor = (r: LeaderRow): string => {
    if (variant === 'points') return r.deltaPct !== 0 ? `${Math.abs(r.deltaPct)}%` : '—';
    return r.timePerAvg ?? '—';
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-card flex items-center justify-between border-b border-outline-variant">
        <div>
          <h3 className="font-title-lg text-title-lg text-on-surface">{title}</h3>
          <p className="text-label-md text-on-surface-variant font-label-md">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest border-b border-outline-variant">
              <th className="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant">Rank</th>
              <th className="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant">
                {variant === 'points' ? 'Student' : 'Expert'}
              </th>
              <th className="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant text-right">
                {variant === 'points' ? 'Points' : 'Accuracy'}
              </th>
              <th className="px-6 py-4 font-label-lg text-label-lg text-on-surface-variant text-right">
                {variant === 'points' ? 'Progress' : 'Time/Avg'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {rows.map((r) => {
              const currentRow = r.isCurrentUser;
              return (
                <tr
                  key={r.rank}
                  className={[
                    currentRow
                      ? 'bg-secondary-container/10 border-l-4 border-secondary'
                      : 'hover:bg-surface-container-low',
                    r.highlight === 'bronze' && !currentRow ? 'opacity-60' : '',
                    'transition-colors group',
                  ].join(' ')}
                >
                  <td className="px-6 py-4">
                    <span
                      className={[
                        'w-8 h-8 flex items-center justify-center rounded-full font-bold text-label-md',
                        currentRow
                          ? 'bg-secondary text-white shadow-sm'
                          : r.highlight === 'gold'
                            ? 'bg-yellow-100 text-yellow-700'
                            : r.highlight === 'silver'
                              ? 'bg-slate-100 text-slate-700'
                              : r.highlight === 'bronze'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-surface-container-highest text-on-surface-variant',
                      ].join(' ')}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {r.avatarUrl ? (
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full overflow-hidden ${
                            currentRow ? 'border-2 border-secondary' : 'bg-slate-200'
                          }`}
                        >
                          <img alt="Student" src={r.avatarUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span
                            className={[
                              'font-label-lg text-label-lg',
                              currentRow ? 'text-secondary' : 'text-on-surface',
                            ].join(' ')}
                          >
                            {r.name}
                          </span>
                          {r.badge && (
                            <span
                              className={[
                                'text-[10px] font-bold uppercase tracking-wider',
                                currentRow
                                  ? r.badge === 'New High!'
                                    ? 'text-on-tertiary-container'
                                    : 'text-secondary/70'
                                  : '',
                              ].join(' ')}
                            >
                              {r.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span
                          className={[
                            'font-label-lg text-label-lg',
                            currentRow ? 'text-secondary' : 'text-on-surface',
                          ].join(' ')}
                        >
                          {r.name}
                        </span>
                        {r.badge && (
                          <span className="text-[10px] text-on-tertiary-container font-bold">
                            {r.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td
                    className={[
                      'px-6 py-4 text-right font-label-md',
                      currentRow ? 'text-secondary font-bold' : 'text-primary',
                    ].join(' ')}
                  >
                    {valueFor(r)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {variant === 'points' ? (
                      <span
                        className={[
                          'text-label-md flex items-center justify-end gap-1',
                          r.deltaPct >= 0 ? 'text-on-tertiary-container' : 'text-error',
                        ].join(' ')}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {r.deltaPct >= 0 ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                        {trailingFor(r)}
                      </span>
                    ) : (
                      <span className="text-label-md text-on-surface">{trailingFor(r)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
