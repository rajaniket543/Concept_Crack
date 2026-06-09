import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import ProgressBar from '../Student/components/ProgressBar';
import { questionBankRows, questionDifficulty } from '../../mocks/portal';
import { pathFor } from '../../lib/pages';
import { apiRequest } from '../../lib/api';

export default function QuestionBankManagement() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [rowsData, setRowsData] = useState(questionBankRows);
  const [difficultyData, setDifficultyData] = useState(questionDifficulty);
  const [suggestedMergeNote, setSuggestedMergeNote] = useState(
    'The system suggests merging two repeated vectors questions from last month to reduce overlap.',
  );

  useEffect(() => {
    void apiRequest<{
      questionBankRows: typeof questionBankRows;
      questionDifficulty: typeof questionDifficulty;
      suggestedMergeNote: string;
    }>('/api/faculty/question-bank')
      .then((payload) => {
        setRowsData(payload.questionBankRows);
        setDifficultyData(payload.questionDifficulty);
        setSuggestedMergeNote(payload.suggestedMergeNote);
      })
      .catch(() => {
        setRowsData(questionBankRows);
        setDifficultyData(questionDifficulty);
      });
  }, []);

  const rows = useMemo(() => {
    return rowsData.filter((row) => {
      const matchesSearch =
        `${row.subject} ${row.chapter} ${row.difficulty} ${row.relevance} ${row.type}`.toLowerCase().includes(search.toLowerCase());
      const matchesSubject = subject === 'All' || row.subject === subject;
      const matchesDifficulty = difficulty === 'All' || row.difficulty === difficulty;
      return matchesSearch && matchesSubject && matchesDifficulty;
    });
  }, [difficulty, rowsData, search, subject]);

  return (
    <div className="min-h-full bg-surface">
      <PageHeader
        title="Question Bank Management"
        subtitle="Search, audit, and curate the question repository."
        actions={
          <>
            <Link
              to={pathFor('faculty')}
              className="px-4 h-10 inline-flex items-center rounded-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              Faculty Dashboard
            </Link>
            <button
              type="button"
              className="px-4 h-10 inline-flex items-center rounded-lg bg-secondary text-on-secondary hover:opacity-90"
            >
              Add Question
            </button>
          </>
        }
      />

      <div className="p-container-desktop space-y-stack-lg">
        <Card title="Repository Filters">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-label-md text-on-surface-variant">Search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapter, topic, or exam"
                className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant">Subject</span>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              >
                <option>All</option>
                <option>Mathematics</option>
                <option>Physics</option>
                <option>Chemistry</option>
              </select>
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant">Difficulty</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              >
                <option>All</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSubject('All');
                  setDifficulty('All');
                }}
                className="w-full rounded-lg border border-outline px-4 py-3 text-label-lg hover:bg-surface-container"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </Card>

        <Card title="Questions">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant text-label-md uppercase tracking-widest text-on-surface-variant">
                  <th className="py-3 pr-4">Subject</th>
                  <th className="py-3 pr-4">Chapter</th>
                  <th className="py-3 pr-4">Difficulty</th>
                  <th className="py-3 pr-4">Relevance</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.subject}-${row.chapter}`} className="border-b border-outline-variant/40 last:border-b-0">
                    <td className="py-4 pr-4">{row.subject}</td>
                    <td className="py-4 pr-4 font-label-lg text-label-lg text-on-surface">{row.chapter}</td>
                    <td className="py-4 pr-4">
                      <span className="rounded-full bg-primary-fixed px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
                        {row.difficulty}
                      </span>
                    </td>
                    <td className="py-4 pr-4">{row.relevance}</td>
                    <td className="py-4 pr-4">{row.type}</td>
                    <td className="py-4 pr-4 text-right">
                      <button type="button" className="text-primary font-label-lg hover:underline">
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
          <Card title="Difficulty Distribution" className="xl:col-span-5">
            <div className="space-y-4">
              {difficultyData.map((item) => (
                <ProgressBar
                  key={item.label}
                  label={item.label}
                  trailing={`${item.percent}%`}
                  percent={item.percent}
                  barClass={item.barClass}
                />
              ))}
            </div>
          </Card>

          <Card title="Audit Mode" className="xl:col-span-7">
            <div className="rounded-2xl bg-secondary-fixed p-5">
              <div className="flex items-center gap-2 text-secondary">
                <span className="material-symbols-outlined">fact_check</span>
                <span className="font-label-lg text-label-lg">Batch Audit Ready</span>
              </div>
              <p className="mt-3 text-body-lg text-on-surface">
                {suggestedMergeNote}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                'Subject + Chapter',
                'Exam Relevance',
                'Question Pattern Merge',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="text-label-md uppercase tracking-widest text-on-surface-variant">Signal</div>
                  <div className="mt-2 font-label-lg text-label-lg text-on-surface">{item}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Add Question">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter items-start">
            <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Question title"
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              />
              <input
                placeholder="Chapter"
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary"
              />
              <select className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary">
                <option>Subject</option>
                <option>Mathematics</option>
                <option>Physics</option>
                <option>Chemistry</option>
              </select>
              <select className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:border-primary">
                <option>Difficulty</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
            <div className="xl:col-span-5 rounded-2xl bg-primary text-white p-6">
              <div className="text-label-md uppercase tracking-widest opacity-70">AI Suggestion</div>
              <p className="mt-3 text-body-lg text-white/80">
                The system suggests merging two repeated vectors questions from last month to reduce overlap and improve
                spread across the difficulty ladder.
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-white text-primary py-3 font-label-lg hover:bg-surface-container-lowest"
              >
                Save Draft
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
