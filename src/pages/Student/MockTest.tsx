import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import Spinner from '../../components/Spinner';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream, STREAM_COLORS, type StudentStream } from '../../lib/stream';
import { getChaptersForSubject, getQuestionsForCustomTest, dedupeQuestions, type ExamQuestion } from '../../lib/questions';
import { createTest } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

// Full-length mock test blueprints that mirror the real exams.
//   JEE Main : Physics 25 · Chemistry 25 · Mathematics 25  = 75 Q · 180 min
//   NEET     : Physics 45 · Chemistry 45 · Biology 90      = 180 Q · 180 min
const MOCK_PATTERN: Record<StudentStream, { durationMin: number; sections: { subject: string; count: number }[] }> = {
  JEE: {
    durationMin: 180,
    sections: [
      { subject: 'Physics', count: 25 },
      { subject: 'Chemistry', count: 25 },
      { subject: 'Mathematics', count: 25 },
    ],
  },
  NEET: {
    durationMin: 180,
    sections: [
      { subject: 'Physics', count: 45 },
      { subject: 'Chemistry', count: 45 },
      { subject: 'Biology', count: 90 },
    ],
  },
};

export default function MockTest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const confirm  = useConfirm();
  const uid      = getAuthSession()?.user?.id ?? '';
  const stream   = (getStudentStream() ?? 'JEE') as StudentStream;
  const pattern  = MOCK_PATTERN[stream];
  const totalQuestions = pattern.sections.reduce((n, s) => n + s.count, 0);

  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  async function startMock() {
    const ok = await confirm({
      title: `Start a full ${stream} mock test?`,
      message: `${totalQuestions} questions across ${pattern.sections.map(s => s.subject).join(', ')} · ${pattern.durationMin} minutes. The timer runs continuously, just like the real exam.`,
      confirmLabel: 'Start mock test',
      icon: 'quiz',
    });
    if (!ok) return;

    setGenerating(true);
    try {
      const allIds: string[] = [];
      const usedFingerprints = new Set<string>();

      for (const section of pattern.sections) {
        setProgressMsg(`Assembling ${section.subject} (${section.count} questions)…`);
        const chapters = (await getChaptersForSubject(section.subject)).map(c => c.chapter);
        if (chapters.length === 0) continue;

        // Pull a generous pool across every chapter of the subject, then dedupe.
        const { questions } = await getQuestionsForCustomTest({
          subject: section.subject,
          chapters,
          difficulty: 'Mixed',
          count: section.count * 3, // over-fetch so we can drop repeats and still hit the target
        });

        // Guard against any question already chosen (across sections) repeating.
        const unique = dedupeQuestions(questions).filter((q: ExamQuestion) => {
          const fp = q.prompt.toLowerCase().replace(/\s+/g, ' ').trim();
          if (usedFingerprints.has(fp)) return false;
          usedFingerprints.add(fp);
          return true;
        });

        allIds.push(...unique.slice(0, section.count).map(q => q.id));
      }

      if (allIds.length === 0) {
        toast('No questions are available to build a mock test yet. Ask your faculty to add questions.', 'error');
        setGenerating(false);
        return;
      }

      const testId = await createTest({
        type:            'mock',
        status:          'active',
        title:           `${stream} Full Mock Test — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        createdBy:       uid,
        subjects:        pattern.sections.map(s => s.subject),
        chapters:        [],
        difficulty:      'Mixed',
        questionCount:   allIds.length,
        durationSeconds: pattern.durationMin * 60,
        startAt:         new Date().toISOString(),
        endAt:           null,
        instructions:    `Full-length ${stream} pattern mock test. Attempt all sections within the time limit.`,
        negativeMarking: true,
        assignedTo:      [uid],
        questionIds:     allIds,
        stream,
      });

      if (allIds.length < totalQuestions) {
        toast(
          `Only ${allIds.length} of ${totalQuestions} questions were available right now, so the mock test was built with the available unique questions.`,
          'info'
        );
      }

      navigate(pathFor('exam'), { state: { testId, examTitle: `${stream} Full Mock Test` } });
    } catch (err) {
      console.error(err);
      toast('Failed to generate the mock test. Please try again.', 'error');
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
        <TopBar breadcrumb={[{ label: 'Mock Test' }]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <Spinner size={34} color="#5B4FE8" />
          <div className="text-center">
            <p className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>Building your {stream} mock test…</p>
            <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>{progressMsg || 'Selecting questions with no repeats…'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Mock Test' }]} />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Full Mock Test
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              A complete <strong>{stream}</strong>-pattern paper, assembled fresh from the question bank with no repeated questions.
            </p>
          </div>

          {/* Pattern card */}
          <Card title={`${stream} Exam Pattern`} subtitle={`${totalQuestions} questions · ${pattern.durationMin} minutes · +4 / −1 marking`}>
            <div className="space-y-3">
              {pattern.sections.map(s => {
                const color = STREAM_COLORS[s.subject] ?? '#5B4FE8';
                return (
                  <div key={s.subject} className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color }}>menu_book</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{s.subject}</div>
                      <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>All chapters · random selection</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color }}>{s.count}</div>
                      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>questions</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Total Questions', value: totalQuestions, icon: 'quiz' },
                { label: 'Duration', value: `${pattern.durationMin}m`, icon: 'timer' },
                { label: 'Marking', value: '+4 / −1', icon: 'calculate' },
              ].map(x => (
                <div key={x.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#5B4FE8' }}>{x.icon}</span>
                  <div className="text-base font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{x.value}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{x.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(91,79,232,0.05)', border: '1px solid rgba(91,79,232,0.15)' }}>
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: '20px', color: '#5B4FE8' }}>info</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Every mock test is unique — questions are pulled at random from across all chapters and de-duplicated, so you never see the same question twice in one paper. Your result is saved to <strong>Review Tests</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void startMock()}
            className="btn-primary btn-md w-full justify-center"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_arrow</span>
            Generate &amp; Start Mock Test
          </button>
        </div>
      </div>
    </div>
  );
}
