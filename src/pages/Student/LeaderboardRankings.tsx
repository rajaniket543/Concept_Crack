import { useState } from 'react';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import { leaderboard } from '../../mocks/student';

type Period = 'Daily' | 'Weekly' | 'Monthly';

const PODIUM_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];
const PODIUM_HEIGHT = ['h-28', 'h-20', 'h-16'];
const MEDAL_ICONS = ['emoji_events', 'workspace_premium', 'military_tech'];

const initialsOf = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function LeaderboardRankings() {
  const [period, setPeriod] = useState<Period>('Weekly');
  const data = leaderboard;

  // Illustrative sample rankings — this app has no cross-student ranking
  // backend yet, so there's no real data source for a global leaderboard.
  // Shape: data.podium (top 3, already in 2nd/1st/3rd display order) and
  // data.batch (full rank list, including the current user).
  const top3 = data.podium;
  const rest = data.batch;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Leaderboard' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Leaderboard
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              Real-time rankings across your batch, institution, and nationally
            </p>
          </div>
          <div className="tab-pills">
            {(['Daily', 'Weekly', 'Monthly'] as Period[]).map(p => (
              <button key={p} type="button" onClick={() => setPeriod(p)} className={`tab-pill ${period === p ? 'active' : ''}`}>{p}</button>
            ))}
          </div>
        </div>

        {/* Your rank summary */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(107,94,240,0.08), rgba(124,58,237,0.05))', border: '1px solid rgba(107,94,240,0.20)', borderLeft: '3px solid var(--brand)' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: 'Your Rank',      value: `#${data.userPerformance.rank}`,        color: '#6B5EF0', icon: 'person' }, // hex literal — concatenated with an alpha suffix below
              { label: 'Out Of',         value: String(data.userPerformance.outOf),     color: '#10B981', icon: 'group' },
              { label: 'Mastery',        value: `${data.userPerformance.masteryPct}%`,  color: '#F59E0B', icon: 'trending_up' },
              { label: 'Streak',         value: `${data.userPerformance.streakDays}d`,  color: '#8B5CF6', icon: 'local_fire_department' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}15` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: item.color }}>{item.icon}</span>
                </div>
                <div>
                  <div className="text-xl font-bold font-headline" style={{ color: item.color, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{item.value}</div>
                  <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Podium — top 3 this period */}
        {top3.length > 0 && (
          <Card title="Top 3 — This Period" subtitle={`${period} leaderboard`}>
            <div className="flex items-end justify-center gap-5 sm:gap-10 py-4">
              {top3.map(student => {
                const rank = student.rank;
                const color = PODIUM_COLORS[rank - 1] ?? PODIUM_COLORS[2];
                const isFirst = rank === 1;
                return (
                  <div key={student.name} className="flex flex-col items-center gap-2.5">
                    <div
                      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
                      style={{
                        width: isFirst ? 64 : 52, height: isFirst ? 64 : 52,
                        fontSize: isFirst ? 20 : 16,
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        boxShadow: isFirst ? `0 0 0 4px ${color}30, 0 8px 20px ${color}40` : `0 6px 16px ${color}30`,
                      }}
                    >
                      {initialsOf(student.name)}
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-body-sm" style={{ color: 'var(--text-primary)' }}>{student.name.split(' ')[0]}</div>
                      <div className="text-label-sm font-bold mt-0.5" style={{ color }}>{student.points} pts</div>
                    </div>
                    <div
                      className={`${PODIUM_HEIGHT[rank - 1]} rounded-t-xl flex flex-col items-center justify-end gap-1 pb-3`}
                      style={{ width: isFirst ? 96 : 80, backgroundColor: `${color}18`, border: `1px solid ${color}40`, borderBottom: 'none' }}
                    >
                      <span className="material-symbols-outlined filled" style={{ fontSize: isFirst ? 26 : 20, color }}>
                        {MEDAL_ICONS[rank - 1]}
                      </span>
                    </div>
                    <div
                      className="h-7 rounded-b-xl flex items-center justify-center text-sm font-bold text-white -mt-2.5"
                      style={{ width: isFirst ? 96 : 80, backgroundColor: color }}
                    >
                      #{rank}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Main content: subject breakdown + table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Subject breakdown */}
          <Card title="Top Subjects" subtitle={`${period} performance`}>
            <div className="space-y-2">
              {['Physics', 'Chemistry', 'Mathematics'].map((s, i) => {
                const colors = ['var(--brand)', '#8B5CF6', '#10B981'];
                const scores = [82, 76, 88];
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-body-sm w-24" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                    <div className="flex-1 progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${scores[i]}%`, backgroundColor: colors[i] }} />
                    </div>
                    <span className="text-label-sm font-semibold w-10 text-right" style={{ color: colors[i] }}>{scores[i]}%</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Full rank table */}
          <Card
            title="Batch Rankings"
            subtitle={`Top performers this ${period.toLowerCase()}`}
            action={<span className="badge badge-brand">{rest.length} students</span>}
            className="lg:col-span-2"
            noPad
          >
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Points</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map(student => {
                    const isMe = student.isCurrentUser;
                    const rankChange = student.deltaPct ?? 0;
                    return (
                      <tr
                        key={student.name}
                        style={isMe ? { backgroundColor: 'var(--brand-muted)' } : undefined}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            {student.rank <= 3 ? (
                              <span className="material-symbols-outlined filled" style={{ fontSize: '18px', color: PODIUM_COLORS[student.rank - 1] }}>{MEDAL_ICONS[student.rank - 1]}</span>
                            ) : (
                              <span className="text-body-md font-semibold w-5 text-center" style={{ color: 'var(--text-muted)' }}>#{student.rank}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
                            >
                              {initialsOf(student.name)}
                            </div>
                            <div>
                              <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>
                                {student.name}
                                {isMe && <span className="ml-1.5 badge badge-brand" style={{ fontSize: '9px' }}>You</span>}
                              </div>
                              {student.badge && <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{student.badge}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {student.points}
                          </span>
                        </td>
                        <td>
                          <span
                            className="inline-flex items-center gap-0.5 text-label-md"
                            style={{ color: rankChange > 0 ? '#10B981' : rankChange < 0 ? '#EF4444' : '#9CA3AF' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              {rankChange > 0 ? 'arrow_upward' : rankChange < 0 ? 'arrow_downward' : 'remove'}
                            </span>
                            {rankChange !== 0 ? Math.abs(rankChange) : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
