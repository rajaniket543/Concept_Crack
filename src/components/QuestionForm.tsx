import { useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from './Toast';
import { QUESTION_ORIGINS, type QuestionOrigin } from '../lib/questionBank';
import { uploadQuestionImage } from '../lib/storage';

// Shared question editor — used by the Question Bank's Add/Edit flows and by
// the Reported Questions review page's Edit action, so a question is always
// edited through the exact same fields regardless of where the edit started.

export const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

export type Draft = {
  question: string;
  A: string; B: string; C: string; D: string;
  answer: 'A' | 'B' | 'C' | 'D';
  subject: string;
  chapter: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  origin: QuestionOrigin;
  explanation: string;
  imageUrl: string;
};

export const EMPTY_DRAFT: Draft = {
  question: '', A: '', B: '', C: '', D: '', answer: 'A',
  subject: 'Physics', chapter: '', topic: '', difficulty: 'Easy',
  origin: 'Faculty Upload', explanation: '', imageUrl: '',
};

export default function QuestionForm({ draft, setDraft, uid }: { draft: Draft; setDraft: Dispatch<SetStateAction<Draft>>; uid: string }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  async function attachImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadQuestionImage(file, uid);
      set('imageUrl', imageUrl);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Image upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Question</label>
        <textarea value={draft.question} onChange={e => set('question', e.target.value)} rows={2} placeholder="Enter the question text…" className="input-field w-full resize-none" style={inputStyle} />
      </div>

      <div>
        <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Figure (optional)</label>
        {draft.imageUrl ? (
          <div className="relative inline-block">
            <img src={draft.imageUrl} alt="Question figure" className="rounded-lg max-h-48" style={{ border: '1px solid var(--border)' }} />
            <button type="button" onClick={() => set('imageUrl', '')}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#EF4444', color: '#fff' }} title="Remove figure">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        ) : (
          <label className="btn-outline btn-sm inline-flex items-center gap-1.5 cursor-pointer w-fit">
            {uploading
              ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Uploading…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>image</span> Attach figure</>}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={e => { void attachImage(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['A', 'B', 'C', 'D'] as const).map(k => (
          <div key={k}>
            <label className="text-label-sm font-semibold mb-1.5 block flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              Option {k}
              <button type="button" onClick={() => set('answer', k)} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: draft.answer === k ? '#10B981' : 'var(--surface-muted)', color: draft.answer === k ? '#fff' : 'var(--text-faint)' }}>
                {draft.answer === k ? '✓ correct' : 'mark correct'}
              </button>
            </label>
            <input type="text" value={draft[k]} onChange={e => set(k, e.target.value)} className="input-field w-full" style={inputStyle} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
          <select value={draft.subject} onChange={e => set('subject', e.target.value)} className="input-field w-full" style={inputStyle}>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Chapter</label>
          <input type="text" value={draft.chapter} onChange={e => set('chapter', e.target.value)} placeholder="e.g. Kinematics" className="input-field w-full" style={inputStyle} />
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Topic</label>
          <input type="text" value={draft.topic} onChange={e => set('topic', e.target.value)} placeholder="e.g. Projectile motion" className="input-field w-full" style={inputStyle} />
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
          <select value={draft.difficulty} onChange={e => set('difficulty', e.target.value as Draft['difficulty'])} className="input-field w-full" style={inputStyle}>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Origin</label>
          <select value={draft.origin} onChange={e => set('origin', e.target.value as QuestionOrigin)} className="input-field w-full" style={inputStyle}>
            {QUESTION_ORIGINS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Explanation (optional)</label>
        <textarea value={draft.explanation} onChange={e => set('explanation', e.target.value)} rows={2} placeholder="Why the correct answer is correct…" className="input-field w-full resize-none" style={inputStyle} />
      </div>
    </div>
  );
}
