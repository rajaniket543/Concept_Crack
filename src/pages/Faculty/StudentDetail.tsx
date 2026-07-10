import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { getMockStudentProfile, type MockStudentProfile } from '../../lib/db';
import { pathFor } from '../../lib/pages';
import { STREAM_COLORS, STREAM_BG, type StudentStream } from '../../lib/stream';
import { formatExamCountdown } from '../../lib/examCountdown';

const SUBJECT_ICONS: Record<string, string> = {
  Physics:     'bolt',
  Chemistry:   'science',
  Mathematics: 'calculate',
  Biology:     'biotech',
};

function seeded(seed: number, min: number, max: number) {
  const s = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.round(min + s * (max - min));
}

function buildSubjects(student: MockStudentProfile) {
  const isNEET  = student.stream === 'NEET';
  const third   = isNEET ? 'Biology' : 'Mathematics';
  const base    = student.accuracy;
  return [
    { subject: 'Physics',  pct: seeded(base * 3 + 1, Math.max(40, base - 15), Math.min(100, base + 10)) },
    { subject: 'Chemistry', pct: seeded(base * 7 + 2, Math.max(40, base - 12), Math.min(100, base + 8)) },
    { subject: third,      pct: seeded(base * 5 + 3, Math.max(40, base - 10), Math.min(100, base + 12)) },
  ];
}

function buildTestHistory(student: MockStudentProfile) {
  const names = ['Chapter Test', 'Mock Test', 'Full Syllabus', 'Unit Test', 'Revision Test'];
  return Array.from({ length: 5 }, (_, i) => ({
    title:    `${names[i]} ${i + 1}`,
    date:     `${27 - i * 5} May 2025`,
    score:    seeded(student.rank * 11 + i * 7, Math.max(45, student.score - 20 + i * 3), Math.min(100, student.score + 10)),
    accuracy: seeded(student.rank * 13 + i * 5, Math.max(50, student.accuracy - 15 + i * 2), Math.min(100, student.accuracy + 8)),
  }));
}

function buildWeakAreas(student: MockStudentProfile) {
  const isNEET = student.stream === 'NEET';
  const jeeWeak  = ['Circular Motion', 'Wave Optics', 'Electrochemistry', 'Complex Numbers', 'Thermodynamics'];
  const neetWeak = ['Genetics', 'Human Physiology', 'Chemical Bonding', 'Optics', 'Cell Biology'];
  return (isNEET ? neetWeak : jeeWeak).map((name, i) => ({
    name,
    pct: seeded(student.rank * 7 + i * 11, 38, 68),
  }));
}

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<MockStudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    getMockStudentProfile(studentId)
      .then(p => { setStudent(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Faculty', href: pathFor('faculty') }, { label: 'Student' }]} />
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-4xl" style={{ color: '#14B8A6' }}>progress_activity</span>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Faculty', href: pathFor('faculty') }, { label: 'Student' }]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--text-faint)' }}>person_off</span>
          <p style={{ color: 'var(--text-muted)' }}>Student not found.</p>
          <Link to={pathFor('faculty')} className="btn-outline btn-md">Back to Faculty</Link>
        </div>
      </div>
    );
  }

  const subjects    = buildSubjects(student);
  const testHistory = buildTestHistory(student);
  const weakAreas   = buildWeakAreas(student);

  const metrics = [
    { label: 'Latest Score',  value: `${student.score}%`,     icon: 'trending_up',        color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
    { label: 'Accuracy',      value: `${student.accuracy}%`,  icon: 'my_location',        color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Batch Rank',    value: `#${student.rank}`,      icon: 'military_tech',      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Attendance',    value: `${student.attendance}%`,icon: 'calendar_month',     color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  ];

  const initials = student.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const statusColor = student.accuracy >= 80 ? '#10B981' : student.accuracy >= 65 ? '#F59E0B' : '#EF4444';
  const statusLabel = student.accuracy >= 80 ? 'Performing Well' : student.accuracy >= 65 ? 'Needs Attention' : 'At Risk';

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Faculty Dashboard', href: pathFor('faculty') }, { label: student.name }]}
        actions={
          <Link to={pathFor('faculty')} className="btn-outline btn-md flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to Students
          </Link>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        {/* Student profile banner */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-5"
          style={{
            background:   'linear-gradient(135deg, rgba(20,184,166,0.08), rgba(13,148,136,0.05))',
            border:       '1px solid rgba(20,184,166,0.20)',
            borderLeft:   '4px solid #14B8A6',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              {student.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span>{student.stream} Stream</span>
              <span>·</span>
              <span>{formatExamCountdown(student.stream === 'NEET' ? 'NEET' : ('JEE' as StudentStream))}</span>
              <span>·</span>
              <span>{student.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold"
              style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(m => (
            <div key={m.label} className="card">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: m.bg }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: m.color }}>{m.icon}</span>
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Subject mastery */}
          <Card title="Subject Mastery" subtitle={`${student.stream} subjects`}>
            <div className="space-y-5">
              {subjects.map(s => {
                const color = STREAM_COLORS[s.subject] ?? '#5B4FE8';
                const bg    = STREAM_BG[s.subject]    ?? 'rgba(91,79,232,0.10)';
                return (
                  <div key={s.subject}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color }}>{SUBJECT_ICONS[s.subject] ?? 'science'}</span>
                        </div>
                        <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{s.subject}</span>
                      </div>
                      <span className="text-label-lg font-bold" style={{ color }}>{s.pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill transition-all duration-700" style={{ width: `${s.pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Test history */}
          <Card title="Test History" subtitle="Last 5 attempts" className="lg:col-span-2" noPad>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testHistory.map((t, i) => (
                    <tr key={i}>
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.title}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{t.date}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="progress-bar w-14">
                            <div className="progress-bar-fill" style={{ width: `${t.score}%`, backgroundColor: '#14B8A6' }} />
                          </div>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t.score}%</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.accuracy}%</td>
                      <td>
                        <span className={`badge ${t.score >= 80 ? 'badge-success' : t.score >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                          {t.score >= 80 ? 'Good' : t.score >= 60 ? 'Average' : 'Needs work'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Weak areas + Progress info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Weak Areas" subtitle="Topics needing attention">
            <div className="space-y-3">
              {weakAreas.map(w => (
                <div
                  key={w.name}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}
                >
                  <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{w.name}</span>
                  <span className="text-label-lg font-bold" style={{ color: w.pct >= 60 ? '#F59E0B' : '#EF4444' }}>{w.pct}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Progress Summary" subtitle="Overall learning status">
            <div className="space-y-4">
              {[
                { label: 'Overall Accuracy',  value: student.accuracy,  color: '#14B8A6' },
                { label: 'Latest Score',      value: student.score,     color: '#5B4FE8' },
                { label: 'Attendance',        value: student.attendance, color: '#10B981' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span className="text-label-lg font-bold" style={{ color: item.color }}>{item.value}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill transition-all duration-700" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}

              {student.progress?.lastActivity && (
                <div
                  className="mt-4 p-3.5 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <p className="text-label-sm uppercase tracking-widest mb-1" style={{ color: 'var(--text-faint)' }}>Last Activity</p>
                  <p className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{student.progress.lastActivity.title}</p>
                  <p className="text-label-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(student.progress.lastActivity.completedAt).toLocaleDateString()}
                    {student.progress.lastActivity.score !== undefined && ` · Score: ${student.progress.lastActivity.score}%`}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
