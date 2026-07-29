import { useEffect, useState } from 'react';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import { leaderboard } from '../../mocks/student';
import { apiRequest } from '../../lib/api';

type Period = 'Daily' | 'Weekly' | 'Monthly';

const PODIUM_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];
const PODIUM_HEIGHT = ['h-28', 'h-20', 'h-16'];
const MEDAL_ICONS = ['emoji_events', 'workspace_premium', 'military_tech'];

export default function LeaderboardRankings() {
  const [period, setPeriod] = useState<Period>('Weekly');
  const [data, setData] = useState<any>(leaderboard);

  useEffect(() => {
    void apiRequest<any>('/api/student/leaderboard')
      .then(setData)
      .catch(() => setData(leaderboard));
  }, []);

  const top3 = [data.topStudents?.[1], data.topStudents?.[0], data.topStudents?.[2]].filter(Boolean);
  const rest = data.topStudents?.slice(3) ?? [];

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
              { label: 'Your Rank',      value: `#${data.myRank ?? 247}`,      color: '#6B5EF0', icon: 'person' }, // hex literal — concatenated with an alpha suffix below
              { label: 'Batch Rank',     value: `#${data.batchRank ?? 12}`,    color: '#10B981', icon: 'group' },
              { label: 'Percentile',     value: `${data.percentile ?? 94}th`,  color: '#F59E0B', icon: 'trending_up' },
              { label: 'Points',         value: `${data.points ?? 8420}`,      color: '#8B5CF6', icon: 'stars' },
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

        {/* Main content: podium + table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Podium */}
          <Card title="Top 3 — This Period" subtitle={`${period} leaderboard`}>
            <div className="flex items-end justify-center gap-3 mt-4 mb-6">
              {top3.map((student: any, idx) => {
                const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
                const rank = podiumOrder[idx] + 1;
                const colorIdx = rank - 1;
                return (
                  <div key={student?.name ?? idx} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white`}
                      style={{ background: `linear-gradient(135deg, ${PODIUM_COLORS[colorIdx]}cc, ${PODIUM_COLORS[colorIdx]})` }}
                    >
                      {student?.initials ?? student?.name?.slice(0, 2)}
                    </div>
                    <div className="text-xs text-center">
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{student?.name?.split(' ')[0]}</div>
                      <div style={{ color: PODIUM_COLORS[colorIdx] }}>{student?.score ?? student?.points}pts</div>
                    </div>
                    <div
                      className={`w-16 ${PODIUM_HEIGHT[rank - 1]} rounded-t-lg flex items-end justify-center pb-2`}
                      style={{ backgroundColor: `${PODIUM_COLORS[colorIdx]}20`, border: `1px solid ${PODIUM_COLORS[colorIdx]}40` }}
                    >
                      <span className="material-symbols-outlined filled" style={{ fontSize: '20px', color: PODIUM_COLORS[colorIdx] }}>
                        {MEDAL_ICONS[rank - 1]}
                      </span>
                    </div>
                    <div
                      className="w-16 h-6 rounded-b-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: PODIUM_COLORS[colorIdx] }}
                    >
                      #{rank}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subject breakdown */}
            <div className="space-y-2">
              <p className="text-label-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Top subjects</p>
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
            action={<span className="badge badge-brand">{data.topStudents?.length ?? 0} students</span>}
            className="lg:col-span-2"
            noPad
          >
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topStudents?.map((student: any, i: number) => {
                    const isMe = student.isCurrentUser;
                    const rankChange = student.rankChange ?? (Math.random() > 0.5 ? Math.ceil(Math.random() * 5) : -Math.ceil(Math.random() * 3));
                    return (
                      <tr
                        key={student.name}
                        style={isMe ? { backgroundColor: 'var(--brand-muted)' } : undefined}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            {i < 3 ? (
                              <span className="material-symbols-outlined filled" style={{ fontSize: '18px', color: PODIUM_COLORS[i] }}>{MEDAL_ICONS[i]}</span>
                            ) : (
                              <span className="text-body-md font-semibold w-5 text-center" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
                            >
                              {student.initials ?? student.name?.slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>
                                {student.name}
                                {isMe && <span className="ml-1.5 badge badge-brand" style={{ fontSize: '9px' }}>You</span>}
                              </div>
                              <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{student.institute ?? 'Batch A'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {student.score ?? student.points}
                          </span>
                        </td>
                        <td>
                          <span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>
                            {student.accuracy ?? student.accuracyPct ?? 75}%
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
