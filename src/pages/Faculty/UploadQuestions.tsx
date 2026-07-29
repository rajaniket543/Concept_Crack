import { useState } from 'react';
import { useToast } from '../../components/Toast';
import QuestionReviewPanel from '../../components/QuestionReviewPanel';
import { extractQuestionsFromFiles, extractionAvailable, type ExtractedQuestion } from '../../lib/extract';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
// 'BOTH' covers content genuinely shared across JEE and NEET (most Physics/
// Chemistry material) — only pick JEE/NEET when the content is actually
// stream-specific, so the same upload doesn't wrongly get excluded from the
// other stream's students later.
const STREAMS = ['BOTH', 'JEE', 'NEET'] as const;

const UPLOAD_OPTIONS = [
  { icon: 'picture_as_pdf', title: 'Complete PDF', desc: 'Allen / Aakash paper, coaching module or question booklet — every question is detected.' },
  { icon: 'photo_camera',   title: 'Images',       desc: 'Camera photos, screenshots or scanned pages — read with OCR.' },
  { icon: 'description',    title: 'Single-question PDF', desc: 'One question with its options, diagram, answer and explanation.' },
];

export default function UploadQuestions() {
  const toast = useToast();

  const [files, setFiles]             = useState<File[]>([]);
  const [hintSubject, setHintSubject] = useState('');
  const [hintChapter, setHintChapter] = useState('');
  const [hintStream, setHintStream]   = useState<typeof STREAMS[number]>('BOTH');
  const [extracting, setExtracting]   = useState(false);
  const [items, setItems]             = useState<ExtractedQuestion[]>([]);

  const available = extractionAvailable();
  const inputStyle = { backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' } as const;

  function onFilesSelected(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
    if (picked.length === 0) { toast('Please choose a PDF or image file', 'error'); return; }
    setFiles(prev => [...prev, ...picked]);
  }

  async function extract() {
    if (files.length === 0) { toast('Add at least one PDF or image', 'error'); return; }
    setExtracting(true);
    try {
      const extracted = await extractQuestionsFromFiles(files, { subject: hintSubject || undefined, chapter: hintChapter || undefined });
      setItems(extracted);
      toast(`Detected ${extracted.length} question${extracted.length === 1 ? '' : 's'} — review & edit below`, 'success');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Extraction failed', 'error');
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Upload Questions
        </h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
          Upload a PDF or images and let AI extract the questions, options and answers for you to review.
        </p>
      </div>

      {!available && (
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#B91C1C', border: '1px solid rgba(239,68,68,0.20)' }}>
          AI extraction needs a Gemini API key (VITE_GEMINI_API_KEY). You can still add questions manually from the Question Bank.
        </div>
      )}

      {/* Supported sources */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {UPLOAD_OPTIONS.map(o => (
          <div key={o.title} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--faculty-accent)' }}>{o.icon}</span>
            <div className="text-sm font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{o.title}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.desc}</div>
          </div>
        ))}
      </div>

      {/* Uploader */}
      <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-xl py-8 cursor-pointer transition-all"
          style={{ border: '2px dashed var(--border)', backgroundColor: 'var(--surface-muted)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 34, color: 'var(--faculty-accent)' }}>upload_file</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Click to choose a PDF or images</span>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>PDF, PNG, JPG · up to ~18 MB total</span>
          <input type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={e => { onFilesSelected(e.target.files); e.target.value = ''; }} />
        </label>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: f.type === 'application/pdf' ? '#EF4444' : 'var(--faculty-accent)' }}>
                  {f.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                </span>
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="icon-btn icon-btn-sm"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject hint (optional)</label>
            <select value={hintSubject} onChange={e => setHintSubject(e.target.value)} className="input-field w-full" style={inputStyle}>
              <option value="">Auto-detect</option>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Chapter hint (optional)</label>
            <input type="text" value={hintChapter} onChange={e => setHintChapter(e.target.value)} placeholder="e.g. Electrostatics" className="input-field w-full" style={inputStyle} />
          </div>
          <div>
            <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Stream</label>
            <select value={hintStream} onChange={e => setHintStream(e.target.value as typeof STREAMS[number])} className="input-field w-full" style={inputStyle}>
              {STREAMS.map(s => <option key={s} value={s}>{s === 'BOTH' ? 'Shared (JEE + NEET)' : s}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={extract}
          disabled={extracting || files.length === 0 || !available}
          className="btn-primary btn-md w-full justify-center"
          style={{ background: extracting ? undefined : 'linear-gradient(135deg, var(--faculty-accent), var(--faculty-accent-hover))' }}
        >
          {extracting
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Extracting questions…</>
            : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span> Extract Questions</>}
        </button>
      </div>

      {/* Review & save (shared with AI generation) */}
      <QuestionReviewPanel items={items} setItems={setItems} origin="Faculty Upload" defaultSubject={hintSubject || undefined} stream={hintStream} />
    </div>
  );
}
