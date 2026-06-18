import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { apiRequest } from '../../lib/api';
import { questionBankRows, questionDifficulty } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';

const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  Easy:   { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  Medium: { bg: 'rgba(245,158,11,0.10)', color: '#D97706' },
  Hard:   { bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
};

const DIFF_BAR_COLOR: Record<string, string> = {
  Easy:   '#10B981',
  Medium: '#F59E0B',
  Hard:   '#EF4444',
};

const AUDIT_SIGNALS = ['Subject + Chapter', 'Exam Relevance', 'Question Pattern Merge'];

export default function QuestionBankManagement() {
  const [search,     setSearch]     = useState('');
  const [subject,    setSubject]    = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [rowsData,   setRowsData]   = useState(questionBankRows);
  const [diffData,   setDiffData]   = useState(questionDifficulty);
  const [suggestedMergeNote, setSuggestedMergeNote] = useState(
    'The system suggests merging two repeated vectors questions from last month to reduce overlap.',
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQ, setNewQ] = useState({ title: '', chapter: '', subject: 'Mathematics', difficulty: 'Easy' });

  useEffect(() => {
    void apiRequest<{
      questionBankRows: typeof questionBankRows;
      questionDifficulty: typeof questionDifficulty;
      suggestedMergeNote: string;
    }>('/api/faculty/question-bank')
      .then(payload => {
        setRowsData(payload.questionBankRows);
        setDiffData(payload.questionDifficulty);
        setSuggestedMergeNote(payload.suggestedMergeNote);
      })
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => rowsData.filter(row => {
    const matchesSearch = `${row.subject} ${row.chapter} ${row.difficulty} ${row.relevance} ${row.type}`
      .toLowerCase().includes(search.toLowerCase());
    const matchesSubject    = subject    === 'All' || row.subject    === subject;
    const matchesDifficulty = difficulty === 'All' || row.difficulty === difficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  }), [difficulty, rowsData, search, subject]);

  function resetFilters() {
    setSearch(''); setSubject('All'); setDifficulty('All');
  }

  function handleSaveDraft() {
    if (!newQ.title.trim() || !newQ.chapter.trim()) return;
    setRowsData(prev => [
      { subject: newQ.subject as any, chapter: newQ.chapter, difficulty: newQ.difficulty as 'Easy' | 'Medium' | 'Hard', relevance: 'High', type: 'MCQ' },
      ...prev,
    ]);
    setNewQ({ title: '', chapter: '', subject: 'Mathematics', difficulty: 'Easy' });
    setShowAddForm(false);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Faculty', href: '/faculty' }, { label: 'Question Bank' }]}
        showSearch={false}
        actions={
          <div className="flex items-center gap-2">
            <Link to={pathFor('faculty')} className="btn-outline btn-md flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setShowAddForm(v => !v)}
              className="btn-primary btn-md flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              Add Question
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Question Bank
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Search, audit, and curate the question repository
          </p>
        </div>

        {/* AI Merge Suggestion Banner */}
        <div
          className="rounded-xl p-4 flex items-start gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(91,79,232,0.06))', border: '1px solid rgba(139,92,246,0.20)', borderLeft: '3px solid #8B5CF6' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(139,92,246,0.12)' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: '18px', color: '#8B5CF6' }}>fact_check</span>
          </div>
          <div className="flex-1">
            <div className="text-body-md font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>AI Audit Suggestion</div>
            <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{suggestedMergeNote}</p>
          </div>
          <button type="button" className="btn-outline btn-sm shrink-0">
            Review
          </button>
        </div>

        {/* Filters */}
        <Card title="Repository Filters" subtitle="Filter by subject, difficulty, or keyword">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Search</label>
              <div className="search-bar">
                <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Chapter, topic, or exam..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {['All', 'Mathematics', 'Physics', 'Chemistry'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                className="input-field w-full"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {['All', 'Easy', 'Medium', 'Hard'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" onClick={resetFilters} className="btn-outline btn-md w-full">
                Reset Filters
              </button>
            </div>
          </div>
        </Card>

        {/* Questions table */}
        <Card title="Questions" subtitle={`${rows.length} questions`} noPad>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Chapter</th>
                  <th>Difficulty</th>
                  <th>Relevance</th>
                  <th>Type</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const diffStyle = DIFFICULTY_COLOR[row.difficulty] ?? DIFFICULTY_COLOR.Easy;
                  return (
                    <tr key={`${row.subject}-${row.chapter}-${i}`}>
                      <td>
                        <span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{row.subject}</span>
                      </td>
                      <td>
                        <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{row.chapter}</span>
                      </td>
                      <td>
                        <span
                          className="text-label-sm font-bold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: diffStyle.bg, color: diffStyle.color }}
                        >
                          {row.difficulty}
                        </span>
                      </td>
                      <td><span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{row.relevance}</span></td>
                      <td><span className="text-body-md" style={{ color: 'var(--text-muted)' }}>{row.type}</span></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="text-label-sm font-semibold hover:underline" style={{ color: '#5B4FE8' }}>
                            Preview
                          </button>
                          <button type="button" className="icon-btn icon-btn-sm" title="Edit">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10" style={{ color: 'var(--text-faint)' }}>
                      No questions match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Difficulty distribution + Audit */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Card title="Difficulty Distribution" subtitle="Balance across Easy / Medium / Hard" className="xl:col-span-5">
            <div className="space-y-4">
              {diffData.map((item: any) => {
                const barColor = DIFF_BAR_COLOR[item.label] ?? '#5B4FE8';
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-body-md font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                      <span className="text-label-lg font-bold" style={{ color: barColor }}>{item.percent}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${item.percent}%`, backgroundColor: barColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Audit Mode" subtitle="AI-powered question analysis signals" className="xl:col-span-7">
            <div className="ai-panel mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined filled" style={{ fontSize: '16px', color: '#5B4FE8' }}>fact_check</span>
                <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Batch Audit Ready</span>
              </div>
              <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{suggestedMergeNote}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AUDIT_SIGNALS.map(signal => (
                <div
                  key={signal}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <div className="text-label-sm font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>Signal</div>
                  <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{signal}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Add Question Form */}
        {showAddForm && (
          <Card title="Add New Question" subtitle="Create a new entry in the question bank">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Question Title</label>
                  <input
                    type="text"
                    value={newQ.title}
                    onChange={e => setNewQ(q => ({ ...q, title: e.target.value }))}
                    placeholder="e.g. Integration by parts..."
                    className="input-field w-full"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Chapter</label>
                  <input
                    type="text"
                    value={newQ.chapter}
                    onChange={e => setNewQ(q => ({ ...q, chapter: e.target.value }))}
                    placeholder="e.g. Calculus"
                    className="input-field w-full"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Subject</label>
                  <select
                    value={newQ.subject}
                    onChange={e => setNewQ(q => ({ ...q, subject: e.target.value }))}
                    className="input-field w-full"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    {['Mathematics', 'Physics', 'Chemistry'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Difficulty</label>
                  <select
                    value={newQ.difficulty}
                    onChange={e => setNewQ(q => ({ ...q, difficulty: e.target.value }))}
                    className="input-field w-full"
                    style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    {['Easy', 'Medium', 'Hard'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <button type="button" onClick={handleSaveDraft} className="btn-primary btn-md flex-1" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
                    Save Draft
                  </button>
                  <button type="button" onClick={() => setShowAddForm(false)} className="btn-outline btn-md">
                    Cancel
                  </button>
                </div>
              </div>

              {/* AI suggestion panel */}
              <div
                className="xl:col-span-5 rounded-xl p-5 flex flex-col"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                <div className="text-label-sm font-semibold uppercase tracking-widest mb-3 opacity-75 text-white">AI Suggestion</div>
                <p className="text-body-md text-white/80 flex-1">
                  The system suggests merging two repeated vectors questions from last month to reduce overlap and improve spread across the difficulty ladder.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {['Duplicate detected', 'Complexity mismatch'].map(hint => (
                    <div key={hint} className="text-label-sm bg-white/10 rounded-lg px-3 py-2 text-white/80 flex items-center gap-1.5">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
                      {hint}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
