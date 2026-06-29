import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../../lib/auth';
import { getStudentStream } from '../../lib/stream';
import { getWeakTopics, rankWeakTopics, type TopicStat } from '../../lib/weakTopics';
import { getQuestionsForCustomTest } from '../../lib/questions';
import { createTest } from '../../lib/tests';
import { pathFor } from '../../lib/pages';
import { useToast } from '../../components/Toast';

const AI_TEST_COUNT = 30;

export default function AITest() {
  const navigate = useNavigate();
  const toast    = useToast();
  const uid      = getAuthSession()?.user?.id ?? '';

  const [loading, setLoading]     = useState(true);
  const [weakTopics, setWeakTopics] = useState<TopicStat[]>([]);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview]     = useState<TopicStat[]>([]);

  useEffect(() => {
    if (!uid) return;
    getWeakTopics(uid).then(record => {
      if (record) {
        const ranked = rankWeakTopics(record);
        setWeakTopics(ranked);
        setPreview(ranked.slice(0, 5));
      }
    }).finally(() => setLoading(false));
  }, [uid]);

  async function generateAITest() {
    if (preview.length === 0) { toast('No weak topics found — practice more first!', 'error'); return; }
    setGenerating(true);
    try {
      const topics = preview.slice(0, 5);
      const subjectGroups: Record<string, string[]> = {};
      topics.forEach(t => {
        if (!subjectGroups[t.subject]) subjectGroups[t.subject] = [];
        subjectGroups[t.subject].push(t.chapter);
      });

      const allQuestions: Array<{ id: string }> = [];
      const allIds: string[] = [];

      await Promise.all(
        Object.entries(subjectGroups).map(async ([subject, chapters]) => {
          const perSubjectCount = Math.round(AI_TEST_COUNT * (chapters.length / topics.length));
          const { questionIds } = await getQuestionsForCustomTest({
            subject,
            chapters,
            difficulty: 'Mixed',
            count: Math.max(5, perSubjectCount),
          });
          allIds.push(...questionIds);
        })
      );

      if (allIds.length === 0) {
        toast('No questions available for your weak topics yet', 'error');
        setGenerating(false);
        return;
      }

      const finalIds = allIds.slice(0, AI_TEST_COUNT);
      const subjects  = [...new Set(topics.map(t => t.subject))];
      const chapters  = [...new Set(topics.map(t => t.chapter))];

      const testId = await createTest({
        type:            'ai',
        status:          'active',
        title:           `AI Weak-Topic Test — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        createdBy:       uid,
        subjects,
        chapters,
        difficulty:      'Mixed',
        questionCount:   finalIds.length,
        durationSeconds: finalIds.length * 90,
        startAt:         new Date().toISOString(),
        endAt:           null,
        instructions:    'Generated from your weakest topics to help you improve.',
        negativeMarking: false,
        assignedTo:      [uid],
        questionIds:     finalIds,
        stream:          getStudentStream() ?? 'JEE',
      });

      navigate(pathFor('exam'), { state: { testId, examTitle: 'AI Weak-Topic Test' } });
    } catch (err) {
      console.error(err);
      toast('Failed to generate AI test. Try again.', 'error');
      setGenerating(false);
    }
  }

  function accuracyColor(pct: number) {
    if (pct >= 70) return '#10B981';
    if (pct >= 40) return '#F59E0B';
    return '#EF4444';
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-56 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--surface-muted)' }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          AI-Powered Test
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Auto-generated from your weakest topics to maximize improvement
        </p>
      </div>

      {weakTopics.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--surface)', border: '2px dashed var(--border)' }}>
          <span className="material-symbols-outlined text-5xl block mb-3" style={{ color: 'var(--text-faint)' }}>auto_awesome</span>
          <p className="text-body-md font-semibold" style={{ color: 'var(--text-secondary)' }}>No weak topics detected yet</p>
          <p className="text-body-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Complete a few chapter tests first. The AI will identify your weak areas and create targeted practice.
          </p>
          <button
            type="button"
            onClick={() => navigate(pathFor('practice'))}
            className="btn-primary btn-md mt-4 mx-auto"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            Go Practice
          </button>
        </div>
      ) : (
        <>
          {/* How it works */}
          <div className="rounded-2xl p-4 flex gap-4 items-start" style={{ backgroundColor: 'rgba(91,79,232,0.06)', border: '1px solid rgba(91,79,232,0.15)' }}>
            <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ color: '#5B4FE8', fontSize: 22 }}>info</span>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              The AI selects your 5 weakest chapters, samples {AI_TEST_COUNT} questions from them, and creates a focused test. After you complete it, your weak topic scores update automatically.
            </p>
          </div>

          {/* Weak topics list */}
          <div>
            <h2 className="text-label-lg font-bold mb-3" style={{ color: 'var(--text-secondary)' }}>
              Topics Selected for This Test
            </h2>
            <div className="space-y-2">
              {preview.map((t, i) => (
                <div
                  key={`${t.subject}::${t.chapter}`}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.chapter}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.subject} · {t.attempts} attempts</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: accuracyColor(t.accuracyPct) }}>
                      {t.accuracyPct}%
                    </p>
                    <div className="w-16 h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${t.accuracyPct}%`, backgroundColor: accuracyColor(t.accuracyPct) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All weak topics below preview */}
          {weakTopics.length > 5 && (
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              +{weakTopics.length - 5} more weak topics tracked · AI focuses on the 5 weakest
            </p>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={generateAITest}
            disabled={generating}
            className="btn-primary btn-lg w-full justify-center"
            style={{ background: generating ? undefined : 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>auto_awesome</span>
                Generate AI Test ({AI_TEST_COUNT} Questions)
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
