import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getChaptersForSubject, getQuestionsForCustomTest, type ChapterInfo } from '../../lib/questions';
import { createTest } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'] as const;
const QUESTION_COUNTS = [10, 20, 30, 40, 50] as const;
const DURATIONS: Record<number, number> = { 10: 900, 20: 1800, 30: 2700, 40: 3600, 50: 4500 };

type Step = 'subject' | 'chapters' | 'config' | 'generating';

export default function CustomTest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const session  = getAuthSession();
  const uid      = session?.user?.id ?? '';
  const stream   = getStudentStream() ?? 'JEE';

  const subjectOptions = stream === 'NEET'
    ? ['Physics', 'Chemistry', 'Biology']
    : ['Physics', 'Chemistry', 'Mathematics'];

  const [step, setStep]               = useState<Step>('subject');
  const [subject, setSubject]         = useState('');
  const [chapters, setChapters]       = useState<ChapterInfo[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty]   = useState<string>('Mixed');
  const [count, setCount]             = useState(30);
  const [loadingCh, setLoadingCh]     = useState(false);

  async function pickSubject(s: string) {
    setSubject(s);
    setSelectedChapters(new Set());
    setLoadingCh(true);
    setStep('chapters');
    try {
      const ch = await getChaptersForSubject(s);
      setChapters(ch);
    } catch {
      toast('Failed to load chapters', 'error');
    } finally {
      setLoadingCh(false);
    }
  }

  function toggleChapter(ch: string) {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }

  function toggleAll() {
    if (selectedChapters.size === chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(chapters.map(c => c.chapter)));
    }
  }

  async function generateTest() {
    if (selectedChapters.size === 0) { toast('Select at least one chapter', 'error'); return; }
    setStep('generating');
    try {
      const { questions, questionIds } = await getQuestionsForCustomTest({
        subject,
        chapters: Array.from(selectedChapters),
        difficulty,
        count,
      });
      if (questions.length === 0) {
        toast('No questions found for your selection', 'error');
        setStep('config');
        return;
      }
      const actualCount = questions.length;
      const testId = await createTest({
        type:            'custom',
        status:          'active',
        title:           `Custom: ${subject} (${Array.from(selectedChapters).slice(0, 2).join(', ')}${selectedChapters.size > 2 ? '…' : ''})`,
        createdBy:       uid,
        subjects:        [subject],
        chapters:        Array.from(selectedChapters),
        difficulty:      difficulty as 'Easy' | 'Medium' | 'Hard' | 'Mixed',
        questionCount:   actualCount,
        durationSeconds: DURATIONS[count as keyof typeof DURATIONS] ?? actualCount * 90,
        startAt:         new Date().toISOString(),
        endAt:           null,
        instructions:    '',
        negativeMarking: false,
        assignedTo:      [uid],
        questionIds,
      });
      navigate(pathFor('exam'), { state: { testId, examTitle: `Custom ${subject} Test` } });
    } catch (err) {
      console.error(err);
      toast('Failed to generate test. Please try again.', 'error');
      setStep('config');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Build Custom Test
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Pick your subject, chapters, and difficulty to create a personalized test
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {(['subject', 'chapters', 'config'] as Step[]).map((s, i) => {
          const steps: Step[] = ['subject', 'chapters', 'config'];
          const idx = steps.indexOf(step);
          const done = steps.indexOf(s) < idx || step === 'generating';
          const active = s === step && step !== 'generating';
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px flex-1 min-w-6" style={{ backgroundColor: done ? '#5B4FE8' : 'var(--border)' }} />}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: done || active ? '#5B4FE8' : 'var(--surface-muted)',
                  color: done || active ? '#fff' : 'var(--text-muted)',
                }}
              >
                {done ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : i + 1}
              </div>
              <span className="text-sm font-medium capitalize hidden sm:block" style={{ color: active ? '#5B4FE8' : 'var(--text-muted)' }}>
                {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step: Subject */}
      {step === 'subject' && (
        <div className="space-y-3">
          <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-secondary)' }}>Choose Subject</h2>
          {subjectOptions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => pickSubject(s)}
              className="w-full text-left rounded-2xl p-4 flex items-center gap-4 transition-all"
              style={{
                backgroundColor: 'var(--surface)',
                border: '1.5px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
                  {s === 'Physics' ? 'bolt' : s === 'Chemistry' ? 'science' : s === 'Biology' ? 'biotech' : 'functions'}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>JEE / NEET Preparation</div>
              </div>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-faint)' }}>chevron_right</span>
            </button>
          ))}
        </div>
      )}

      {/* Step: Chapters */}
      {step === 'chapters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
              Select Chapters ({selectedChapters.size} selected)
            </h2>
            <button type="button" onClick={toggleAll} className="btn-ghost btn-sm">
              {selectedChapters.size === chapters.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {loadingCh ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {chapters.map(ch => {
                const on = selectedChapters.has(ch.chapter);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChapter(ch.chapter)}
                    className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                    style={{
                      backgroundColor: on ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                      border: `1.5px solid ${on ? '#5B4FE8' : 'var(--border)'}`,
                    }}
                  >
                    <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: on ? '#5B4FE8' : 'var(--border)', backgroundColor: on ? '#5B4FE8' : 'transparent' }}
                    >
                      {on && <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>}
                    </div>
                    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ch.chapter}</span>
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{ch.questionCount}q</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep('subject')} className="btn-outline btn-md flex-1">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep('config')}
              disabled={selectedChapters.size === 0}
              className="btn-primary btn-md flex-1"
              style={{ background: selectedChapters.size === 0 ? undefined : 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step: Config */}
      {step === 'config' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Difficulty</h2>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: difficulty === d ? '#5B4FE8' : 'var(--surface)',
                    color: difficulty === d ? '#fff' : 'var(--text-muted)',
                    border: `1.5px solid ${difficulty === d ? '#5B4FE8' : 'var(--border)'}`,
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Number of Questions</h2>
            <div className="grid grid-cols-5 gap-2">
              {QUESTION_COUNTS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className="py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    backgroundColor: count === n ? '#5B4FE8' : 'var(--surface)',
                    color: count === n ? '#fff' : 'var(--text-muted)',
                    border: `1.5px solid ${count === n ? '#5B4FE8' : 'var(--border)'}`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: 'rgba(91,79,232,0.06)', border: '1px solid rgba(91,79,232,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color: '#5B4FE8' }}>Test Summary</h3>
            {[
              ['Subject', subject],
              ['Chapters', `${selectedChapters.size} selected`],
              ['Difficulty', difficulty],
              ['Questions', count],
              ['Duration', `${Math.round(DURATIONS[count as keyof typeof DURATIONS] / 60)} min`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep('chapters')} className="btn-outline btn-md flex-1">
              Back
            </button>
            <button
              type="button"
              onClick={generateTest}
              className="btn-primary btn-md flex-1"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
              Generate & Start
            </button>
          </div>
        </div>
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-full border-3 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#5B4FE8', borderTopColor: 'transparent', borderWidth: 3 }} />
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>Generating your test…</p>
          <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>Selecting {count} questions from {selectedChapters.size} chapter{selectedChapters.size !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  );
}
