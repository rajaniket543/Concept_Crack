import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { guestQuestions, type GuestQuestion, type Subject } from '../data/guestQuestions';

type Attempt = { id: string; title: string; date: string; questions: string[]; answers: Record<string, number> };
type ActiveTest = { title: string; questions: GuestQuestion[]; deadline: number };
const STORAGE_KEY = 'concept-crack:guest-results:v1';
function readHistory(): Attempt[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((a): a is Attempt => a && typeof a.id === 'string' && typeof a.title === 'string' && typeof a.date === 'string' && Array.isArray(a.questions) && a.questions.length > 0 && a.questions.every((id: unknown) => guestQuestions.some(q => q.id === id)) && a.answers && typeof a.answers === 'object' && Object.values(a.answers).every(v => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 3)).slice(0, 30);
  } catch { return []; }
}
const card = { background: 'var(--surface)', border: '1px solid var(--border)' };

export default function GuestPractice() {
  const [stream, setStream] = useState<'JEE' | 'NEET'>('JEE');
  const [tab, setTab] = useState<'practice' | 'mock' | 'history'>('practice');
  const [history, setHistory] = useState(readHistory);
  const [storageError, setStorageError] = useState(false);
  const [test, setTest] = useState<ActiveTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [review, setReview] = useState<Attempt | null>(null);
  const [confirm, setConfirm] = useState<'submit' | 'leave' | null>(null);
  const subjects: Subject[] = ['Physics', 'Chemistry', stream === 'JEE' ? 'Mathematics' : 'Biology'];

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [history]);

  const submit = useCallback(() => {
    if (!test) return;
    const attempt: Attempt = { id: crypto.randomUUID(), title: test.title, date: new Date().toISOString(), questions: test.questions.map(q => q.id), answers: { ...answers } };
    setHistory(previous => [attempt, ...previous].slice(0, 30));
    setReview(attempt);
    setTest(null);
    setConfirm(null);
  }, [test, answers]);

  useEffect(() => {
    if (!test) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((test.deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => { window.clearInterval(timer); window.removeEventListener('beforeunload', warn); };
  }, [test]);

  useEffect(() => {
    if (test && remaining === 0) submit();
  }, [remaining, test, submit]);

  function start(subject?: Subject) {
    const questions = guestQuestions.filter(q => subject ? q.subject === subject : subjects.includes(q.subject));
    const seconds = questions.length * 90;
    setAnswers({}); setIndex(0); setReview(null); setConfirm(null); setRemaining(seconds);
    setTest({ title: subject ? `${subject} starter practice` : `${stream} mini mock test`, questions, deadline: Date.now() + seconds * 1000 });
  }

  const question = test?.questions[index];
  const reviewed = review ? review.questions.map(id => guestQuestions.find(q => q.id === id)!) : [];
  const correct = review ? reviewed.filter(q => review.answers[q.id] === q.correct).length : 0;
  const answered = review ? reviewed.filter(q => review.answers[q.id] !== undefined).length : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <header className="border-b px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
        {test ? <Logo size="sm" /> : <Link to="/" aria-label="Concept Crack home"><Logo size="sm" /></Link>}
        <div className="flex items-center gap-4"><span className="text-xs font-semibold rounded-full px-3 py-1 bg-violet-500/10 text-violet-500">Guest mode</span>{!test && <Link to="/login" className="btn-outline btn-sm">Log in</Link>}</div>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        {storageError && <p role="status" className="text-amber-600">Browser storage is unavailable. Results will only remain available until you leave this page.</p>}
        {!test && !review && <>
          <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
            <p className="text-sm text-violet-100 mb-2">YOUR PREPARATION STARTS HERE</p>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Explore. Practice. Build confidence.</h1>
            <p className="max-w-2xl text-violet-100">Try free starter questions, take a timed mini mock, and review every answer. No login required.</p>
          </div>
          <div className="flex flex-wrap justify-between gap-4">
            <nav aria-label="Guest practice" className="flex flex-wrap gap-2">{(['practice', 'mock', 'history'] as const).map(item => <button key={item} onClick={() => setTab(item)} aria-pressed={tab === item} className={tab === item ? 'btn-primary btn-md' : 'btn-outline btn-md'}>{item === 'practice' ? 'Subject practice' : item === 'mock' ? 'Mini mock test' : 'My results'}</button>)}</nav>
            <div className="flex gap-2" role="group" aria-label="Exam stream">{(['JEE', 'NEET'] as const).map(value => <button key={value} className={stream === value ? 'btn-primary btn-md' : 'btn-outline btn-md'} aria-pressed={stream === value} onClick={() => setStream(value)}>{value}</button>)}</div>
          </div>
          {tab === 'practice' && <section className="grid md:grid-cols-3 gap-4" aria-label="Subjects">{subjects.map(subject => <article key={subject} className="rounded-2xl p-6 space-y-4" style={card}>
            <span className="material-symbols-outlined text-violet-500 text-3xl" aria-hidden="true">{subject === 'Physics' ? 'bolt' : subject === 'Chemistry' ? 'science' : subject === 'Biology' ? 'biotech' : 'calculate'}</span>
            <h2 className="text-xl font-bold">{subject}</h2><p style={{ color: 'var(--text-muted)' }}>{guestQuestions.filter(q => q.subject === subject).map(q => q.topic).join(' · ')}</p>
            <p className="text-sm">5 questions · 7 min 30 sec</p><button className="btn-primary btn-md w-full" onClick={() => start(subject)}>Practice {subject}</button>
          </article>)}</section>}
          {tab === 'mock' && <section className="rounded-2xl p-6 space-y-4" style={card}><h2 className="text-2xl font-bold">{stream} mini mock test</h2><p>Mix {subjects.join(', ')} in one timed test.</p><p>15 questions · 22 min 30 sec · +4 correct, −1 incorrect, 0 skipped</p><p style={{ color: 'var(--text-muted)' }}>A starter sample to explore the test experience, not a full-length exam simulation. Uses the same questions as subject practice.</p><button className="btn-primary btn-md" onClick={() => start()}>Start mini mock</button></section>}
          {tab === 'history' && <section className="space-y-3"><h2 className="text-2xl font-bold">My results</h2>{history.length === 0 ? <p>No tests completed yet. Choose a subject to start practicing.</p> : history.map(attempt => <button key={attempt.id} onClick={() => setReview(attempt)} className="w-full text-left rounded-xl p-5 flex flex-wrap justify-between gap-3" style={card}><span>{attempt.title}<span className="block text-sm" style={{ color: 'var(--text-muted)' }}>{new Date(attempt.date).toLocaleString()}</span></span><span className="text-violet-500 font-semibold">Review answers →</span></button>)}</section>}
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Free starter library · Results from your last 30 tests are saved in this browser only. Log in for your account dashboard and assigned tests.</p>
        </>}

        {test && question && <>
          <div className="flex flex-wrap justify-between gap-4 items-center"><div><h1 className="text-2xl font-bold">{test.title}</h1><p className="text-sm mt-1">+4 correct · −1 incorrect · 0 skipped</p></div><p role="timer" aria-label="Time remaining" className="text-xl font-mono">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p></div>
          <div className="grid lg:grid-cols-[1fr_240px] gap-5">
            <section className="rounded-2xl p-5 sm:p-8 space-y-6" style={card}>
              <p className="text-sm text-violet-500">Question {index + 1} of {test.questions.length} · {question.subject} · {question.topic}</p>
              <fieldset><legend className="text-xl font-semibold mb-6">{question.text}</legend><div className="space-y-3">{question.options.map((option, optionIndex) => <label key={optionIndex} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer ${answers[question.id] === optionIndex ? 'border-violet-500 bg-violet-500/10' : 'border-[var(--border)]'}`}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(previous => ({ ...previous, [question.id]: optionIndex }))} /><span>{option}</span></label>)}</div></fieldset>
              <div className="flex flex-wrap gap-2 justify-between"><button className="btn-outline btn-md" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Previous</button><button className="btn-outline btn-md" onClick={() => setAnswers(previous => { const next = { ...previous }; delete next[question.id]; return next; })}>Clear answer</button><button className="btn-primary btn-md" disabled={index === test.questions.length - 1} onClick={() => setIndex(i => i + 1)}>Next</button></div>
            </section>
            <aside className="rounded-2xl p-5 space-y-5" style={card}><h2 className="font-bold">Question navigator</h2><p className="text-sm">{Object.keys(answers).length} of {test.questions.length} answered</p><div className="grid grid-cols-5 gap-2">{test.questions.map((q, i) => <button key={q.id} aria-label={`Question ${i + 1}${answers[q.id] !== undefined ? ', answered' : ', unanswered'}`} aria-current={index === i ? 'step' : undefined} onClick={() => setIndex(i)} className={`rounded-lg p-2 border ${index === i ? 'border-violet-500' : 'border-transparent'} ${answers[q.id] !== undefined ? 'bg-violet-600 text-white' : 'bg-violet-500/10'}`}>{i + 1}</button>)}</div><button className="btn-primary btn-md w-full" onClick={() => setConfirm('submit')}>Submit test</button><button className="btn-outline btn-md w-full" onClick={() => setConfirm('leave')}>Exit test</button></aside>
          </div>
          {confirm && <section role="alert" className="rounded-xl p-5 space-y-4" style={card}><h2 className="font-bold">{confirm === 'submit' ? 'Submit your test?' : 'Leave this test?'}</h2><p>{confirm === 'submit' ? `${test.questions.length - Object.keys(answers).length} unanswered questions will receive 0 marks.` : 'Your current answers will be discarded.'}</p><div className="flex gap-3"><button className="btn-primary btn-md" onClick={() => { if (confirm === 'submit') submit(); else { setTest(null); setConfirm(null); } }}>{confirm === 'submit' ? 'Confirm submission' : 'Discard and exit'}</button><button className="btn-outline btn-md" onClick={() => setConfirm(null)}>Keep practicing</button></div></section>}
        </>}

        {review && <>
          <div className="flex flex-wrap justify-between gap-4"><div><p className="text-violet-500">TEST COMPLETE</p><h1 className="text-3xl font-bold mt-2">{review.title}</h1></div><button className="btn-primary btn-md" onClick={() => { setReview(null); setTab('practice'); }}>Back to practice</button></div>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-label="Test results">{[['Score', `${correct * 4 - (answered - correct)} / ${reviewed.length * 4}`], ['Correct', correct], ['Incorrect', answered - correct], ['Skipped', reviewed.length - answered]].map(([label, value]) => <div key={label} className="rounded-xl p-5" style={card}><p className="text-sm">{label}</p><p className="text-2xl font-bold mt-2">{value}</p></div>)}</section>
          <h2 className="text-2xl font-bold">Answers & explanations</h2>
          {reviewed.map((q, i) => <article key={q.id} className="rounded-xl p-5 space-y-3" style={card}><p className="text-sm text-violet-500">Question {i + 1} · {q.subject} · {review.answers[q.id] === undefined ? 'Skipped' : review.answers[q.id] === q.correct ? 'Correct' : 'Incorrect'}</p><h3 className="font-semibold">{q.text}</h3><p>Your answer: {q.options[review.answers[q.id]] ?? 'Not answered'}</p><p className="font-semibold">Correct answer: {q.options[q.correct]}</p><p style={{ color: 'var(--text-muted)' }}>{q.explanation}</p></article>)}
        </>}
      </main>
    </div>
  );
}
