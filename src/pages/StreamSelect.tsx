import { useState } from 'react';
import Spinner from '../components/Spinner';
import { useNavigate } from 'react-router-dom';
import { type StudentStream, saveStreamLocal, STREAM_SUBJECTS } from '../lib/stream';
import { saveStudentStream } from '../lib/db';
import { getAuthSession } from '../lib/auth';

const STREAM_DEFS: {
  key: StudentStream;
  label: string;
  full: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  gradient: string;
  desc: string;
  exams: string[];
}[] = [
  {
    key:      'JEE',
    label:    'JEE',
    full:     'Joint Entrance Examination',
    icon:     'calculate',
    color:    '#5B4FE8',
    bg:       'rgba(91,79,232,0.08)',
    border:   'rgba(91,79,232,0.30)',
    gradient: 'linear-gradient(135deg, #5B4FE8, #7C3AED)',
    desc:     'Engineering entrance for IITs, NITs & top engineering colleges.',
    exams:    ['JEE Main', 'JEE Advanced', 'BITSAT'],
  },
  {
    key:      'NEET',
    label:    'NEET',
    full:     'National Eligibility cum Entrance Test',
    icon:     'biotech',
    color:    '#14B8A6',
    bg:       'rgba(20,184,166,0.08)',
    border:   'rgba(20,184,166,0.30)',
    gradient: 'linear-gradient(135deg, #14B8A6, #0D9488)',
    desc:     'Medical entrance for MBBS, BDS & AYUSH programmes.',
    exams:    ['NEET UG', 'AIIMS', 'JIPMER'],
  },
];

export default function StreamSelect() {
  const navigate  = useNavigate();
  const session   = getAuthSession();
  const [selected, setSelected] = useState<StudentStream | null>(null);
  const [saving,   setSaving]   = useState(false);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    saveStreamLocal(selected);
    if (session?.user?.id) {
      await saveStudentStream(session.user.id, selected).catch(() => undefined);
    }
    setSaving(false);
    navigate('/student', { replace: true });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <img src="/logo.png" alt="Concept Crack" className="w-9 h-9 rounded-xl object-cover" />
        <span className="font-bold text-lg" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
          Concept Crack
        </span>
      </div>

      {/* Heading */}
      <div className="text-center mb-10 max-w-md">
        <h1 className="text-display-sm font-bold mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
          Choose Your Stream
        </h1>
        <p className="text-body-md" style={{ color: 'var(--text-muted)' }}>
          Select the exam you're preparing for. This personalises your subjects, tests, and recommendations.
        </p>
      </div>

      {/* Stream cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {STREAM_DEFS.map(s => {
          const isSelected = selected === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className="text-left rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 focus:outline-none"
              style={{
                backgroundColor:  isSelected ? s.bg : 'var(--surface)',
                border:           isSelected ? `2px solid ${s.color}` : '2px solid var(--border)',
                boxShadow:        isSelected ? `0 8px 24px ${s.color}22` : 'var(--shadow-xs)',
              }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: isSelected ? s.gradient : 'var(--surface-muted)' }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '28px', color: isSelected ? '#fff' : s.color }}
                >
                  {s.icon}
                </span>
              </div>

              {/* Title */}
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                  {s.label}
                </h2>
                {isSelected && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: s.gradient }}
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: '14px' }}>check</span>
                  </div>
                )}
              </div>
              <p className="text-label-sm mb-3" style={{ color: s.color, fontWeight: 600 }}>{s.full}</p>
              <p className="text-body-sm mb-4" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>

              {/* Subjects */}
              <div className="space-y-1.5 mb-4">
                <p className="text-label-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Subjects</p>
                {STREAM_SUBJECTS[s.key].map(sub => (
                  <div key={sub} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-body-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sub}</span>
                  </div>
                ))}
              </div>

              {/* Exam chips */}
              <div className="flex flex-wrap gap-1.5">
                {s.exams.map(exam => (
                  <span
                    key={exam}
                    className="text-label-sm px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: isSelected ? s.bg : 'var(--surface-muted)', color: isSelected ? s.color : 'var(--text-muted)', border: `1px solid ${isSelected ? s.border : 'var(--border)'}` }}
                  >
                    {exam}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm */}
      <div className="mt-8 w-full max-w-2xl">
        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="w-full h-12 rounded-xl font-semibold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: selected
              ? (STREAM_DEFS.find(s => s.key === selected)?.gradient ?? 'linear-gradient(135deg, #5B4FE8, #7C3AED)')
              : 'var(--surface-muted)',
            boxShadow: selected ? '0 4px 14px rgba(91,79,232,0.30)' : 'none',
          }}
        >
          {saving ? (
            <>
              <Spinner size={16} />
              Saving…
            </>
          ) : (
            <>
              Continue as {selected ?? '…'}
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
            </>
          )}
        </button>
        <p className="text-center text-body-sm mt-3" style={{ color: 'var(--text-faint)' }}>
          You can change this later from Settings
        </p>
      </div>
    </div>
  );
}
