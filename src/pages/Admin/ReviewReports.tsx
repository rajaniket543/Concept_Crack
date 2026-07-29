import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import Spinner from '../../components/Spinner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TestVerification, TestStatus } from '../../lib/tests';

// Dedicated Faculty Review Reports page (2p): every test that entered the
// verification workflow, with the verifier's decision and written remarks.

interface ReviewRow {
  id: string;
  title: string;
  subjects: string[];
  status: TestStatus;
  createdBy: string;
  facultyName: string;
  verification: TestVerification;
}

const STAGE_META: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  awaiting: { label: 'Awaiting review', bg: 'rgba(59,130,246,0.10)',  color: '#2563EB', icon: 'hourglass_top' },
  verified: { label: 'Verified',        bg: 'rgba(16,185,129,0.10)',  color: '#059669', icon: 'verified' },
  rejected: { label: 'Rejected',        bg: 'rgba(239,68,68,0.10)',   color: '#DC2626', icon: 'cancel' },
};

const FILTERS = ['All', 'Awaiting', 'Verified', 'Rejected'] as const;

export default function ReviewReports() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [testSnap, userSnap] = await Promise.all([
          getDocs(collection(db, 'tests')),
          getDocs(collection(db, 'users')),
        ]);
        if (cancelled) return;
        const nameById = new Map(userSnap.docs.map(d => [d.id, (d.data().name as string) ?? '—']));
        const list: ReviewRow[] = [];
        testSnap.docs.forEach(d => {
          const t = d.data();
          const verification = t.verification as TestVerification | undefined;
          if (!verification || !verification.stage || verification.stage === 'none') return;
          list.push({
            id: d.id,
            title: (t.title as string) ?? 'Untitled test',
            subjects: (t.subjects as string[]) ?? [],
            status: (t.status as TestStatus) ?? 'pending_approval',
            createdBy: (t.createdBy as string) ?? '',
            facultyName: nameById.get((t.createdBy as string) ?? '') ?? 'Faculty',
            verification,
          });
        });
        list.sort((a, b) => (b.verification.decidedAt ?? b.verification.forwardedAt ?? '').localeCompare(a.verification.decidedAt ?? a.verification.forwardedAt ?? ''));
        setRows(list);
      } catch (e) {
        console.error('review reports load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    if (filter === 'All') return true;
    return r.verification.stage === filter.toLowerCase();
  }), [rows, filter]);

  const counts = useMemo(() => ({
    total: rows.length,
    awaiting: rows.filter(r => r.verification.stage === 'awaiting').length,
    verified: rows.filter(r => r.verification.stage === 'verified').length,
    rejected: rows.filter(r => r.verification.stage === 'rejected').length,
  }), [rows]);

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Review Reports' }]} />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div>
          <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
            Faculty Review Reports
          </h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
            Every coaching test that went through the review workflow — who reviewed it, the decision, and their remarks.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            // Hex literal — concatenated with an alpha suffix below, never var().
            { label: 'Total Reviews', value: counts.total, icon: 'fact_check', color: '#EC4899' },
            { label: 'Awaiting', value: counts.awaiting, icon: 'hourglass_top', color: '#2563EB' },
            { label: 'Verified', value: counts.verified, icon: 'verified', color: '#059669' },
            { label: 'Rejected', value: counts.rejected, icon: 'cancel', color: '#DC2626' },
          ].map(s => (
            <div key={s.label} className="card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${s.color}1F` }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: s.color }}>{s.icon}</span>
              </div>
              <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                {loading ? '…' : s.value}
              </div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <Card noPad>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="tab-pills">
              {FILTERS.map(f => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={`tab-pill ${filter === f ? 'active' : ''}`}>{f}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner size={22} color="var(--admin-accent)" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center" style={{ color: 'var(--text-faint)' }}>
              <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: '30px' }}>fact_check</span>
              {rows.length === 0
                ? 'No review reports yet — forward a pending coaching test to a verifier from Test Approvals.'
                : 'No reviews match this filter.'}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map(r => {
                const meta = STAGE_META[r.verification.stage] ?? STAGE_META.awaiting;
                return (
                  <div key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-label-sm font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: meta.bg, color: meta.color }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{meta.icon}</span>
                            {meta.label}
                          </span>
                          <span className="text-label-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
                            {r.subjects.join(', ') || 'Test'}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{r.title}</h3>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Created by <strong style={{ color: 'var(--text-secondary)' }}>{r.facultyName}</strong>
                          {' · '}Reviewer: <strong style={{ color: 'var(--text-secondary)' }}>{r.verification.verifierName ?? '—'}</strong>
                          {r.verification.verifierDesignation ? ` (${r.verification.verifierDesignation})` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>Forwarded {fmt(r.verification.forwardedAt)}</div>
                        {r.verification.decidedAt && (
                          <div className="text-label-sm" style={{ color: 'var(--text-faint)' }}>Decided {fmt(r.verification.decidedAt)}</div>
                        )}
                      </div>
                    </div>
                    {r.verification.remarks && (
                      <div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <span className="text-label-sm font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--text-faint)' }}>Reviewer remarks</span>
                        {r.verification.remarks}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
