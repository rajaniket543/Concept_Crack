import { useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession } from '../lib/auth';
import { useToast } from './Toast';
import { createBankQuestions, type BankQuestionInput, type QuestionOrigin } from '../lib/questionBank';
import { createTest } from '../lib/tests';
import { pathFor } from '../lib/pages';
import { uploadQuestionImage } from '../lib/storage';
import type { ExtractedQuestion } from '../lib/extract';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

// Shared review + save flow used by both PDF/image upload (Feature 5) and AI
// generation (Feature 6): editable question cards, then the two post-processing
// choices — "Create Test Only" (private) or "Add to Question Bank" (shared).
export default function QuestionReviewPanel({
  items,
  setItems,
  origin,
  defaultSubject,
  stream = 'JEE',
}: {
  items: ExtractedQuestion[];
  setItems: Dispatch<SetStateAction<ExtractedQuestion[]>>;
  origin: QuestionOrigin;
  defaultSubject?: string;
  stream?: string;
}) {
  const navigate = useNavigate();
  const toast    = useToast();
  const session  = getAuthSession();
  const uid      = session?.user?.id ?? '';
  const uname    = session?.user?.name ?? 'Faculty';

  const [saving, setSaving]         = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [testTitle, setTestTitle]   = useState('');
  const [testType, setTestType]     = useState<'faculty_batch' | 'faculty_coaching'>('faculty_batch');
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  function updateItem(i: number, patch: Partial<ExtractedQuestion>) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function updateOption(i: number, key: 'A' | 'B' | 'C' | 'D', value: string) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, options: { ...it.options, [key]: value } } : it)));
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  async function attachImage(i: number, file: File | undefined) {
    if (!file) return;
    setUploadingIdx(i);
    try {
      const imageUrl = await uploadQuestionImage(file, uid);
      updateItem(i, { imageUrl });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Image upload failed', 'error');
    } finally {
      setUploadingIdx(null);
    }
  }

  const isBad = (it: ExtractedQuestion) =>
    !it.question.trim() || !it.answer || !it.chapter.trim() || !it.options.A.trim() || !it.options.B.trim();
  const incomplete = items.filter(isBad);

  function toInputs(isPrivate: boolean): BankQuestionInput[] {
    return items.map(it => ({
      question:   it.question.trim(),
      options:    it.options,
      answer:     (it.answer ?? 'A') as 'A' | 'B' | 'C' | 'D',
      difficulty: it.difficulty,
      subject:    it.subject || defaultSubject || 'Physics',
      chapter:    it.chapter,
      topic:      it.topic,
      origin,
      uploadedBy: uid,
      uploadedByName: uname,
      explanation: it.explanation,
      verificationStatus: 'unverified',
      isPrivate,
      imageUrl: it.imageUrl,
    }));
  }

  function guard(): boolean {
    if (items.length === 0) { toast('Nothing to save', 'error'); return false; }
    if (incomplete.length > 0) {
      toast(`${incomplete.length} question${incomplete.length === 1 ? '' : 's'} still need a question, answer, chapter and options A & B`, 'error');
      return false;
    }
    return true;
  }

  async function addToBank() {
    if (!guard()) return;
    setSaving(true);
    try {
      const created = await createBankQuestions(toInputs(false));
      toast(`${created.length} question${created.length === 1 ? '' : 's'} added to the question bank`, 'success');
      navigate(pathFor('questionBank'));
    } catch (e) {
      console.error(e);
      toast('Failed to save questions', 'error');
    } finally { setSaving(false); }
  }

  async function createTestOnly() {
    if (!guard()) return;
    if (!testTitle.trim()) { toast('Enter a test title', 'error'); return; }
    setSaving(true);
    try {
      const created = await createBankQuestions(toInputs(true));
      const subjects = [...new Set(items.map(it => it.subject).filter(Boolean))];
      const chapters = [...new Set(items.map(it => it.chapter).filter(Boolean))];
      await createTest({
        type:            testType,
        status:          testType === 'faculty_coaching' ? 'pending_approval' : 'active',
        title:           testTitle.trim(),
        createdBy:       uid,
        subjects:        subjects.length ? subjects : (defaultSubject ? [defaultSubject] : ['Physics']),
        chapters,
        difficulty:      'Mixed',
        questionCount:   created.length,
        durationSeconds: created.length * 90,
        startAt:         new Date().toISOString(),
        endAt:           null,
        instructions:    origin === 'Concept Crack AI' ? 'AI-generated test.' : 'Created from an uploaded document.',
        negativeMarking: false,
        lockMode:        'locked',
        autoSubmitViolations: 2,
        assignedTo:      'all',
        questionIds:     created.map(c => c.id),
        stream,
      });
      toast(testType === 'faculty_coaching' ? 'Private test submitted for approval' : 'Private test created & activated', 'success');
      navigate(pathFor('manageTests'));
    } catch (e) {
      console.error(e);
      toast('Failed to create test', 'error');
    } finally { setSaving(false); }
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Review {items.length} question{items.length === 1 ? '' : 's'}
        </h2>
        {incomplete.length > 0 && (
          <span className="text-label-sm font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>
            {incomplete.length} need attention
          </span>
        )}
      </div>

      {items.map((it, i) => {
        const bad = isBad(it);
        return (
          <div key={i} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'var(--surface)', border: `1.5px solid ${bad ? 'rgba(239,68,68,0.5)' : 'var(--border)'}` }}>
            <div className="flex items-center justify-between">
              <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(20,184,166,0.10)', color: '#0D9488' }}>Q{i + 1}</span>
              <button type="button" onClick={() => removeItem(i)} className="text-label-sm font-semibold" style={{ color: '#EF4444' }}>Remove</button>
            </div>
            <textarea value={it.question} onChange={e => updateItem(i, { question: e.target.value })} rows={2} placeholder="Question text" className="input-field w-full resize-none" style={inputStyle} />

            {it.imageUrl ? (
              <div className="relative inline-block">
                <img src={it.imageUrl} alt="Question figure" className="rounded-lg max-h-48" style={{ border: '1px solid var(--border)' }} />
                <button type="button" onClick={() => updateItem(i, { imageUrl: undefined })}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#EF4444', color: '#fff' }} title="Remove figure">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            ) : (
              <label className="btn-outline btn-sm inline-flex items-center gap-1.5 cursor-pointer w-fit">
                {uploadingIdx === i
                  ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Uploading…</>
                  : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>image</span> Attach figure</>}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingIdx !== null}
                  onChange={e => { void attachImage(i, e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['A', 'B', 'C', 'D'] as const).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <button type="button" onClick={() => updateItem(i, { answer: k })} title="Mark correct"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: it.answer === k ? '#10B981' : 'var(--surface-muted)', color: it.answer === k ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {k}
                  </button>
                  <input type="text" value={it.options[k]} onChange={e => updateOption(i, k, e.target.value)} placeholder={`Option ${k}`} className="input-field w-full" style={inputStyle} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select value={it.subject} onChange={e => updateItem(i, { subject: e.target.value })} className="input-field w-full" style={inputStyle}>
                <option value="">Subject…</option>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
              <input type="text" value={it.chapter} onChange={e => updateItem(i, { chapter: e.target.value })} placeholder="Chapter" className="input-field w-full" style={inputStyle} />
              <input type="text" value={it.topic} onChange={e => updateItem(i, { topic: e.target.value })} placeholder="Topic" className="input-field w-full" style={inputStyle} />
              <select value={it.difficulty} onChange={e => updateItem(i, { difficulty: e.target.value as ExtractedQuestion['difficulty'] })} className="input-field w-full" style={inputStyle}>
                {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
        );
      })}

      {/* Post-processing choice */}
      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-label-lg font-bold" style={{ color: 'var(--text-primary)' }}>What next?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-muted)' }}>
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Create Test Only</div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Questions stay private to this test and are not added to the shared bank.</p>
            {showTestForm ? (
              <div className="space-y-2">
                <input type="text" value={testTitle} onChange={e => setTestTitle(e.target.value)} placeholder="Test title" className="input-field w-full" style={inputStyle} />
                <select value={testType} onChange={e => setTestType(e.target.value as typeof testType)} className="input-field w-full" style={inputStyle}>
                  <option value="faculty_batch">Batch test (activate now)</option>
                  <option value="faculty_coaching">Coaching test (needs approval)</option>
                </select>
                <button type="button" onClick={createTestOnly} disabled={saving} className="btn-primary btn-md w-full justify-center" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create Private Test'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowTestForm(true)} className="btn-outline btn-md w-full justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>quiz</span> Use for a Test
              </button>
            )}
          </div>

          <div className="rounded-xl p-4" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-muted)' }}>
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Contribute to Question Bank</div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Adds these questions to the permanent repository (each gets a unique code) for reuse by AI, other faculty and admins.</p>
            <button type="button" onClick={addToBank} disabled={saving} className="btn-primary btn-md w-full justify-center" style={{ background: 'linear-gradient(135deg, #14B8A6, #0D9488)' }}>
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>library_add</span> Add to Bank</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
