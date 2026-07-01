import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream, STREAM_SUBJECTS } from '../../lib/stream';
import { getChaptersForSubject, type ChapterInfo } from '../../lib/questions';
import { getQuestionsForCustomTest } from '../../lib/questions';
import { createTest } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'] as const;
const COUNTS       = [10, 20, 30, 40, 50] as const;

type Step = 'subjects' | 'chapters' | 'config' | 'generating';

export default function CustomTest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const uid      = getAuthSession()?.user?.id ?? '';
  const stream   = getStudentStream() ?? 'JEE';
  const subjects = STREAM_SUBJECTS[stream as keyof typeof STREAM_SUBJECTS] ?? ['Physics', 'Chemistry', 'Mathematics'];

  const [step, setStep]                       = useState<Step>('subjects');
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, ChapterInfo[]>>({});
  const [selectedChapters, setSelectedChapters] = useState<Record<string, Set<string>>>({});
  const [activeSubjectTab, setActiveSubjectTab] = useState('');
  const [difficulty, setDifficulty]           = useState<string>('Mixed');
  const [count, setCount]                     = useState(30);
  const [loadingCh, setLoadingCh]             = useState(false);

  const totalSelected = Object.values(selectedChapters).reduce((acc, s) => acc + s.size, 0);
  const subjectList   = Array.from(selectedSubjects);

  function toggleSubject(s: string) {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
        setSelectedChapters(c => { const n = { ...c }; delete n[s]; return n; });
      } else {
        next.add(s);
      }
      return next;
    });
  }

  async function goToChapters() {
    if (selectedSubjects.size === 0) { toast('Select at least one subject', 'error'); return; }
    setLoadingCh(true);
    setStep('chapters');
    const first = subjectList[0];
    setActiveSubjectTab(first);
    try {
      const entries = await Promise.all(
        subjectList.map(async s => [s, await getChaptersForSubject(s)] as [string, ChapterInfo[]])
      );
      setChaptersBySubject(Object.fromEntries(entries));
    } catch {
      toast('Failed to load chapters', 'error');
    } finally {
      setLoadingCh(false);
    }
  }

  function toggleChapter(subject: string, chapter: string) {
    setSelectedChapters(prev => {
      const subSet = new Set(prev[subject] ?? []);
      if (subSet.has(chapter)) subSet.delete(chapter);
      else subSet.add(chapter);
      return { ...prev, [subject]: subSet };
    });
  }

  function toggleAllChapters(subject: string) {
    const all = chaptersBySubject[subject] ?? [];
    const cur = selectedChapters[subject] ?? new Set();
    setSelectedChapters(prev => ({
      ...prev,
      [subject]: cur.size === all.length ? new Set() : new Set(all.map(c => c.chapter)),
    }));
  }

  async function generateTest() {
    if (totalSelected === 0) { toast('Select at least one chapter', 'error'); return; }
    setStep('generating');
    try {
      const allQIds: string[] = [];

      await Promise.all(subjectList.map(async subject => {
        const chapters = Array.from(selectedChapters[subject] ?? []);
        if (chapters.length === 0) return;
        const perSubject = Math.round(count * (chapters.length / totalSelected));
        const { questionIds } = await getQuestionsForCustomTest({
          subject, chapters, difficulty, count: Math.max(5, perSubject),
        });
        allQIds.push(...questionIds);
      }));

      if (allQIds.length === 0) {
        toast('No questions found for your selection', 'error');
        setStep('config');
        return;
      }

      // Shuffle and cap
      for (let i = allQIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQIds[i], allQIds[j]] = [allQIds[j], allQIds[i]];
      }
      const finalIds   = allQIds.slice(0, count);
      const allChapters = subjectList.flatMap(s => Array.from(selectedChapters[s] ?? []));

      const testId = await createTest({
        type:            'custom',
        status:          'active',
        title:           `Custom: ${subjectList.join(', ')} (${allChapters.slice(0,2).join(', ')}${allChapters.length > 2 ? '…' : ''})`,
        createdBy:       uid,
        subjects:        subjectList,
        chapters:        allChapters,
        difficulty:      difficulty as 'Easy' | 'Medium' | 'Hard' | 'Mixed',
        questionCount:   finalIds.length,
        durationSeconds: finalIds.length * 90,
        startAt:         new Date().toISOString(),
        endAt:           null,
        instructions:    '',
        negativeMarking: false,
        assignedTo:      [uid],
        questionIds:     finalIds,
        stream,
      });
      navigate(pathFor('exam'), { state: { testId, examTitle: 'Custom Test' } });
    } catch (err) {
      console.error(err);
      toast('Failed to generate test. Try again.', 'error');
      setStep('config');
    }
  }

  const subjectIcon = (s: string) =>
    s === 'Physics' ? 'bolt' : s === 'Chemistry' ? 'science' : s === 'Biology' ? 'biotech' : 'functions';

  const StepDot = ({ label, active, done }: { label: string; active: boolean; done: boolean }) => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ backgroundColor: done || active ? '#5B4FE8' : 'var(--surface-muted)', color: done || active ? '#fff' : 'var(--text-muted)' }}>
        {done ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span> : label.charAt(0).toUpperCase()}
      </div>
      <span className="text-sm font-medium hidden sm:block" style={{ color: active ? '#5B4FE8' : 'var(--text-muted)' }}>{label}</span>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Build Custom Test
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Select multiple subjects and chapters to create a personalised test
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-3">
        {(['subjects', 'chapters', 'config'] as Step[]).map((s, i, arr) => (
          <div key={s} className="flex items-center gap-3">
            {i > 0 && <div className="h-px w-8" style={{ backgroundColor: step !== 'subjects' && i <= (['subjects','chapters','config'] as Step[]).indexOf(step) ? '#5B4FE8' : 'var(--border)' }} />}
            <StepDot label={s} active={step === s} done={step !== 'generating' && (['subjects','chapters','config'] as Step[]).indexOf(step) > i} />
          </div>
        ))}
      </div>

      {/* Step 1: Subjects */}
      {step === 'subjects' && (
        <div className="space-y-4">
          <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
            Choose Subjects ({selectedSubjects.size} selected)
          </h2>
          <div className="space-y-3">
            {subjects.map(s => {
              const on = selectedSubjects.has(s);
              return (
                <button key={s} type="button" onClick={() => toggleSubject(s)}
                  className="w-full text-left rounded-2xl p-4 flex items-center gap-4 transition-all"
                  style={{
                    backgroundColor: on ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                    border: `1.5px solid ${on ? '#5B4FE8' : 'var(--border)'}`,
                    boxShadow: 'var(--shadow-sm)',
                  }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: on ? 'linear-gradient(135deg, #5B4FE8, #7C3AED)' : 'var(--surface-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: on ? '#fff' : 'var(--text-muted)' }}>{subjectIcon(s)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold" style={{ color: on ? '#5B4FE8' : 'var(--text-primary)' }}>{s}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{stream} · Select chapters after</div>
                  </div>
                  <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: on ? '#5B4FE8' : 'var(--border)', backgroundColor: on ? '#5B4FE8' : 'transparent' }}>
                    {on && <span className="material-symbols-outlined text-white" style={{ fontSize: 13 }}>check</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={goToChapters} disabled={selectedSubjects.size === 0}
            className="btn-primary btn-md w-full justify-center"
            style={{ background: selectedSubjects.size > 0 ? 'linear-gradient(135deg, #5B4FE8, #7C3AED)' : undefined }}>
            Continue to Chapters
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
        </div>
      )}

      {/* Step 2: Chapters per subject */}
      {step === 'chapters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-label-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
              Select Chapters ({totalSelected} total)
            </h2>
          </div>

          {/* Subject tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {subjectList.map(s => (
              <button key={s} type="button" onClick={() => setActiveSubjectTab(s)}
                className="px-4 py-2 rounded-xl text-sm font-semibold shrink-0 transition-all"
                style={{
                  backgroundColor: activeSubjectTab === s ? '#5B4FE8' : 'var(--surface)',
                  color:           activeSubjectTab === s ? '#fff'    : 'var(--text-muted)',
                  border:          `1.5px solid ${activeSubjectTab === s ? '#5B4FE8' : 'var(--border)'}`,
                }}>
                {s} ({(selectedChapters[s]?.size ?? 0)})
              </button>
            ))}
          </div>

          {loadingCh ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
              ))}
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-2">
                <button type="button" onClick={() => toggleAllChapters(activeSubjectTab)} className="btn-ghost btn-sm">
                  {(selectedChapters[activeSubjectTab]?.size ?? 0) === (chaptersBySubject[activeSubjectTab]?.length ?? 0)
                    ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(chaptersBySubject[activeSubjectTab] ?? []).map(ch => {
                  const on = selectedChapters[activeSubjectTab]?.has(ch.chapter) ?? false;
                  return (
                    <button key={ch.id} type="button" onClick={() => toggleChapter(activeSubjectTab, ch.chapter)}
                      className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                      style={{
                        backgroundColor: on ? 'rgba(91,79,232,0.06)' : 'var(--surface)',
                        border: `1.5px solid ${on ? '#5B4FE8' : 'var(--border)'}`,
                      }}>
                      <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: on ? '#5B4FE8' : 'var(--border)', backgroundColor: on ? '#5B4FE8' : 'transparent' }}>
                        {on && <span className="material-symbols-outlined text-white" style={{ fontSize: 13 }}>check</span>}
                      </div>
                      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ch.chapter}</span>
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{ch.questionCount}q</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep('subjects')} className="btn-outline btn-md flex-1">Back</button>
            <button type="button" onClick={() => setStep('config')} disabled={totalSelected === 0}
              className="btn-primary btn-md flex-1"
              style={{ background: totalSelected > 0 ? 'linear-gradient(135deg, #5B4FE8, #7C3AED)' : undefined }}>
              Configure Test
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Config */}
      {step === 'config' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Difficulty</h2>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTIES.map(d => (
                <button key={d} type="button" onClick={() => setDifficulty(d)}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: difficulty === d ? '#5B4FE8' : 'var(--surface)',
                    color:           difficulty === d ? '#fff'    : 'var(--text-muted)',
                    border:          `1.5px solid ${difficulty === d ? '#5B4FE8' : 'var(--border)'}`,
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>Questions</h2>
            <div className="grid grid-cols-5 gap-2">
              {COUNTS.map(n => (
                <button key={n} type="button" onClick={() => setCount(n)}
                  className="py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    backgroundColor: count === n ? '#5B4FE8' : 'var(--surface)',
                    color:           count === n ? '#fff'    : 'var(--text-muted)',
                    border:          `1.5px solid ${count === n ? '#5B4FE8' : 'var(--border)'}`,
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: 'rgba(91,79,232,0.06)', border: '1px solid rgba(91,79,232,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color: '#5B4FE8' }}>Test Summary</h3>
            {[
              ['Subjects', subjectList.join(', ')],
              ['Chapters', `${totalSelected} selected across ${subjectList.length} subject${subjectList.length !== 1 ? 's' : ''}`],
              ['Difficulty', difficulty],
              ['Questions', count],
              ['Duration', `${Math.round(count * 1.5)} min`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Chapter breakdown per subject */}
          <div className="space-y-2">
            {subjectList.map(s => {
              const chs = Array.from(selectedChapters[s] ?? []);
              if (chs.length === 0) return null;
              return (
                <div key={s} className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#5B4FE8' }}>{subjectIcon(s)}</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {chs.slice(0, 2).join(', ')}{chs.length > 2 ? ` +${chs.length - 2} more` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep('chapters')} className="btn-outline btn-md flex-1">Back</button>
            <button type="button" onClick={generateTest}
              className="btn-primary btn-md flex-1"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
              Generate & Start
            </button>
          </div>
        </div>
      )}

      {/* Generating */}
      {step === 'generating' && (
        <div className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-full animate-spin mx-auto" style={{ border: '3px solid rgba(91,79,232,0.2)', borderTopColor: '#5B4FE8' }} />
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>Generating your test…</p>
          <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
            Sampling {count} questions from {totalSelected} chapters across {subjectList.length} subject{subjectList.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
