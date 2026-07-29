import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/Toast';
import QuestionReviewPanel from '../../components/QuestionReviewPanel';
import { getStudentStream } from '../../lib/stream';
import { getChaptersForSubject } from '../../lib/questions';
import { generateQuestionsAI, extractionAvailable, type ExtractedQuestion } from '../../lib/extract';

const STREAM_SUBJECTS: Record<string, string[]> = {
  JEE:  ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

export default function AIGenerateTest() {
  const toast = useToast();
  const stream = getStudentStream() ?? 'JEE';
  const subjects = STREAM_SUBJECTS[stream] ?? STREAM_SUBJECTS.JEE;

  const [subject, setSubject]   = useState(subjects[0]);
  const [chapter, setChapter]   = useState('');
  const [topic, setTopic]       = useState('');
  const [allChapters, setAllChapters] = useState<string[]>([]);
  const [total, setTotal]       = useState(30);
  const [easy, setEasy]         = useState(10);
  const [medium, setMedium]     = useState(15);
  const [hard, setHard]         = useState(5);
  const [generating, setGenerating] = useState(false);
  const [items, setItems]       = useState<ExtractedQuestion[]>([]);

  const available = extractionAvailable();
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  useEffect(() => {
    getChaptersForSubject(subject).then(ch => setAllChapters(ch.map(c => c.chapter))).catch(() => setAllChapters([]));
  }, [subject]);

  const sum = easy + medium + hard;
  const balanced = sum === total && total > 0;

  const genCounts = useMemo(() => {
    const c = { Easy: 0, Medium: 0, Hard: 0 } as Record<string, number>;
    items.forEach(i => { c[i.difficulty] = (c[i.difficulty] ?? 0) + 1; });
    return c;
  }, [items]);

  function autoBalance() {
    // Split the target total into a sensible Easy/Medium/Hard spread.
    const e = Math.round(total * 0.34);
    const h = Math.round(total * 0.16);
    setEasy(e); setHard(h); setMedium(Math.max(0, total - e - h));
  }

  async function generate() {
    if (!chapter.trim()) { toast('Enter a chapter', 'error'); return; }
    if (!balanced) { toast('Easy + Medium + Hard must equal Total Questions', 'error'); return; }
    setGenerating(true);
    try {
      const qs = await generateQuestionsAI({ subject, chapter: chapter.trim(), topic: topic.trim() || undefined, easy, medium, hard });
      setItems(qs);
      const c = { Easy: 0, Medium: 0, Hard: 0 } as Record<string, number>;
      qs.forEach(q => { c[q.difficulty] = (c[q.difficulty] ?? 0) + 1; });
      const drift = c.Easy !== easy || c.Medium !== medium || c.Hard !== hard;
      toast(
        drift
          ? `Generated ${qs.length} — distribution came back ${c.Easy}E / ${c.Medium}M / ${c.Hard}H, adjust below if needed`
          : `Generated ${qs.length} questions (${c.Easy}E / ${c.Medium}M / ${c.Hard}H)`,
        drift ? 'error' : 'success',
      );
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            AI Test Generator
          </h1>
          <span className="text-label-sm font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(107,94,240,0.10)', color: 'var(--brand)' }}>{stream}</span>
        </div>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Choose a subject, chapter and topic, then set exactly how many Easy, Medium and Hard questions you want.
        </p>
      </div>

      {!available && (
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#B91C1C', border: '1px solid rgba(239,68,68,0.20)' }}>
          AI generation needs a Gemini API key (VITE_GEMINI_API_KEY).
        </div>
      )}

      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Subject / chapter / topic */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
            <select value={subject} onChange={e => { setSubject(e.target.value); setChapter(''); }} className="input-field w-full" style={inputStyle}>
              {subjects.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Chapter</label>
            <input list="chapter-list" type="text" value={chapter} onChange={e => setChapter(e.target.value)} placeholder="e.g. Electrostatics" className="input-field w-full" style={inputStyle} />
            <datalist id="chapter-list">{allChapters.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Topic (optional)</label>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Gauss's law" className="input-field w-full" style={inputStyle} />
          </div>
        </div>

        {/* Total + distribution */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Total Questions</label>
            <input type="number" min={1} max={40} value={total} onChange={e => setTotal(Math.max(0, Number(e.target.value)))} className="input-field w-full" style={inputStyle} />
          </div>
          {([
            { label: 'Easy',   value: easy,   set: setEasy,   color: '#10B981' },
            { label: 'Medium', value: medium, set: setMedium, color: '#F59E0B' },
            { label: 'Hard',   value: hard,   set: setHard,   color: '#EF4444' },
          ] as const).map(d => (
            <div key={d.label}>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: d.color }}>{d.label}</label>
              <input type="number" min={0} max={40} value={d.value} onChange={e => d.set(Math.max(0, Number(e.target.value)))} className="input-field w-full" style={inputStyle} />
            </div>
          ))}
        </div>

        {/* Balance status */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium" style={{ color: balanced ? '#059669' : '#DC2626' }}>
            <span className="material-symbols-outlined align-middle" style={{ fontSize: 16 }}>{balanced ? 'check_circle' : 'error'}</span>{' '}
            Easy + Medium + Hard = {sum} {balanced ? `= ${total} ✓` : `≠ ${total} (Total)`}
          </span>
          {!balanced && (
            <button type="button" onClick={autoBalance} className="btn-ghost btn-sm">Balance for me</button>
          )}
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={generating || !available || !balanced}
          className="btn-primary btn-md w-full justify-center"
          style={{ background: generating ? undefined : 'linear-gradient(135deg, var(--brand), #7C3AED)' }}
        >
          {generating
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating {total} questions…</>
            : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span> Generate {total} Questions</>}
        </button>
      </div>

      {items.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-label-sm">
          <span style={{ color: 'var(--text-muted)' }}>Generated distribution:</span>
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.10)', color: '#059669' }}>{genCounts.Easy} Easy</span>
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.10)', color: '#D97706' }}>{genCounts.Medium} Medium</span>
          <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>{genCounts.Hard} Hard</span>
        </div>
      )}

      {/* Review & save (shared with upload) */}
      <QuestionReviewPanel items={items} setItems={setItems} origin="Concept Crack AI" defaultSubject={subject} stream={stream} />
    </div>
  );
}
