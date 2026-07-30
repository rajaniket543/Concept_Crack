import { useEffect, useState } from 'react';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import {
  upsertMyLeaderboardEntry, buildMyLeaderboardEntry, listLeaderboard,
  sampleLeaderboardEntries, type LeaderboardEntry,
} from '../../lib/leaderboard';

const PODIUM_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];
const PODIUM_HEIGHT = ['h-28', 'h-20', 'h-16'];
const MEDAL_ICONS = ['emoji_events', 'workspace_premium', 'military_tech'];

const initialsOf = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

interface RankedEntry extends LeaderboardEntry {
  rank: number;
  isMe: boolean;
}

export default function LeaderboardRankings() {
  const session = getAuthSession();
  const uid = session?.user?.id;
  const name = session?.user?.name ?? 'You';
  const stream = getStudentStream();

  const [entries, setEntries] = useState<RankedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardUnavailable, setBoardUnavailable] = useState(false);

  // Your own row is computed locally and always shown — publishing your entry
  // to the shared board and reading other students back are both best-effort,
  // so a permissions/network failure on either degrades to "just you" instead
  // of blanking the whole page.
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      let mine: LeaderboardEntry | null = null;
      try {
        mine = await buildMyLeaderboardEntry(uid, name, stream);
      } catch (e) {
        console.error('Failed to compute your leaderboard entry:', e);
      }

      // Best-effort publish so peers can see you; ignored if not permitted.
      let shared = true;
      try {
        if (mine) await upsertMyLeaderboardEntry(uid, name, stream);
      } catch (e) {
        console.error('Could not publish your leaderboard entry:', e);
        shared = false;
      }

      let others: LeaderboardEntry[] = [];
      try {
        others = (await listLeaderboard(stream)).filter(e => e.studentId !== uid);
      } catch (e) {
        console.error('Could not read the shared leaderboard:', e);
        shared = false;
      }
      if (cancelled) return;

      // Padded with generic placeholder rows (never a specific real person) so
      // the podium reads as a full batch while few real students exist yet.
      const MIN_ROWS = 5;
      const real = mine ? [mine, ...others] : others;
      const padded = real.length >= MIN_ROWS
        ? real
        : [...real, ...sampleLeaderboardEntries(stream, MIN_ROWS - real.length)];

      setEntries(
        padded
          .sort((a, b) => b.points - a.points)
          .map((e, i) => ({ ...e, rank: i + 1, isMe: e.studentId === uid })),
      );
      setBoardUnavailable(!shared);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const top3 = entries.length >= 3
    ? [entries[1], entries[0], entries[2]] // display order: 2nd, 1st, 3rd (podium layout)
    : entries;
  const me = entries.find(e => e.isMe);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Dashboard', href: '/student' }, { label: 'Leaderboard' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Header */}
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Leaderboard
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Real-time rankings across your batch, institution, and nationally
          </p>
        </div>

        {/* Your rank summary */}
        {me && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'linear-gradient(135deg, rgba(107,94,240,0.08), rgba(124,58,237,0.05))', border: '1px solid rgba(107,94,240,0.20)', borderLeft: '3px solid var(--brand)' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: 'Your Rank', value: `#${me.rank}`,             color: '#6B5EF0', icon: 'person' }, // hex literal — concatenated with an alpha suffix below
                { label: 'Out Of',    value: String(entries.length),    color: '#10B981', icon: 'group' },
                { label: 'Points',    value: String(me.points),         color: '#F59E0B', icon: 'trending_up' },
                { label: 'Streak',    value: `${me.streakDays}d`,       color: '#8B5CF6', icon: 'local_fire_department' },
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
        )}

        {/* Podium — top 3 real scorers */}
        {top3.length > 0 && (
          <Card
            title="Top 3"
            subtitle={boardUnavailable
              ? 'Your current standing with representative batch positions'
              : 'Students ranked by practice points'}
          >
            <div className="flex items-end justify-center gap-5 sm:gap-10 py-4">
              {top3.map(student => {
                const rank = student.rank;
                const color = PODIUM_COLORS[rank - 1] ?? PODIUM_COLORS[2];
                const isFirst = rank === 1;
                return (
                  <div key={student.studentId} className="flex flex-col items-center gap-2.5">
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

        {/* Full rank table */}
        <Card
          title="Rankings"
          subtitle={`All ${stream ?? ''} students on the board`}
          action={<span className="badge badge-brand">{entries.length} student{entries.length === 1 ? '' : 's'}</span>}
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
                {loading && (
                  <tr><td colSpan={4} className="text-center text-body-sm" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>
                )}
                {!loading && entries.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-body-sm" style={{ color: 'var(--text-muted)' }}>No students on the board yet.</td></tr>
                )}
                {entries.map(student => {
                  const delta = student.points - student.previousPoints;
                  return (
                    <tr
                      key={student.studentId}
                      style={student.isMe ? { backgroundColor: 'var(--brand-muted)' } : undefined}
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
                          <div className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>
                            {student.name}
                            {student.isMe && <span className="ml-1.5 badge badge-brand" style={{ fontSize: '9px' }}>You</span>}
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
                          style={{ color: delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#9CA3AF' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {delta > 0 ? 'arrow_upward' : delta < 0 ? 'arrow_downward' : 'remove'}
                          </span>
                          {delta !== 0 ? Math.abs(delta) : '—'}
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
  );
}
