import { useState } from 'react';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { askAI, hasAI } from '../../lib/ai';

const ACCENT = '#EC4899';

interface Faculty {
  id: string;
  name: string;
  subject: string;
  batches: number;
  students: number;
  avgScore: number;       // % average score of students under them
  conceptClarity: number; // % concept-clarity index
  attendance: number;     // % attendance in their sessions
  weakTopics: string[];
}

const FACULTY: Faculty[] = [
  { id: 'f1', name: 'Dr. R. Iyer',    subject: 'Physics',     batches: 3, students: 84, avgScore: 72, conceptClarity: 78, attendance: 91, weakTopics: ['Rotational Motion', 'Wave Optics'] },
  { id: 'f2', name: 'Prof. S. Menon', subject: 'Chemistry',   batches: 2, students: 61, avgScore: 64, conceptClarity: 66, attendance: 88, weakTopics: ['Organic Mechanisms', 'Chemical Bonding'] },
  { id: 'f3', name: 'Dr. A. Gupta',   subject: 'Mathematics', batches: 4, students: 112, avgScore: 81, conceptClarity: 85, attendance: 94, weakTopics: ['Definite Integration'] },
  { id: 'f4', name: 'Ms. N. Rao',     subject: 'Biology',     batches: 2, students: 57, avgScore: 69, conceptClarity: 71, attendance: 86, weakTopics: ['Genetics', 'Human Physiology'] },
];

export default function FacultyReports() {
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function generate(f: Faculty) {
    setLoadingId(f.id);
    const prompt = `You are an academic performance analyst for Concept Crack (a JEE/NEET coaching platform).
Write a concise report (5-7 sentences) for the ADMIN about a faculty member's effectiveness.

Faculty: ${f.name} — ${f.subject}
Students taught: ${f.students} across ${f.batches} batches
Average student score: ${f.avgScore}%
Concept-clarity index: ${f.conceptClarity}%
Session attendance: ${f.attendance}%
Topics where their students struggle most: ${f.weakTopics.join(', ')}

Assess: how are the students under this faculty performing? Are core concepts being made clear? End with 2 specific, actionable recommendations for the admin/faculty. Be professional and direct.`;

    let text: string;
    try {
      text = hasAI()
        ? await askAI(prompt, { maxTokens: 500 })
        : 'AI reports need an API key. Add VITE_GEMINI_API_KEY to enable AI-generated faculty reports.';
    } catch {
      text = 'Could not generate the report right now — please try again in a moment.';
    }
    setReports(prev => ({ ...prev, [f.id]: text }));
    setLoadingId(null);
  }

  const scoreColor = (v: number) => (v >= 75 ? '#10B981' : v >= 60 ? '#F59E0B' : '#EF4444');

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Faculty Reports' }]} showSearch={false} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Faculty AI Reports
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            AI-generated performance analysis for each faculty member — how their students are doing and whether concepts are landing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {FACULTY.map(f => (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: ACCENT }}>
                    {f.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{f.name}</div>
                    <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{f.subject} · {f.students} students · {f.batches} batches</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Avg Score', value: f.avgScore },
                  { label: 'Concept Clarity', value: f.conceptClarity },
                  { label: 'Attendance', value: f.attendance },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="text-lg font-bold" style={{ color: scoreColor(s.value) }}>{s.value}%</div>
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>Weak topics:</span>
                {f.weakTopics.map(t => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>{t}</span>
                ))}
              </div>

              {reports[f.id] ? (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.20)', borderLeft: `3px solid ${ACCENT}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: ACCENT }}>auto_awesome</span>
                    <span className="text-label-sm font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>AI Report</span>
                  </div>
                  <p className="text-body-md whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{reports[f.id]}</p>
                  <button type="button" onClick={() => void generate(f)} disabled={loadingId === f.id} className="text-label-sm font-semibold mt-3 hover:underline" style={{ color: ACCENT }}>
                    {loadingId === f.id ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void generate(f)}
                  disabled={loadingId === f.id}
                  className="btn-primary btn-md w-full justify-center"
                  style={{ backgroundColor: ACCENT, opacity: loadingId === f.id ? 0.7 : 1 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>
                  {loadingId === f.id ? 'Generating AI report…' : 'Generate AI Report'}
                </button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
