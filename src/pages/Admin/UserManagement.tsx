import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Card from '../../components/Card';
import TopBar from '../../components/TopBar';
import { getDocs, collection, query, where, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { adminCreateUser, adminResetPassword, adminSetUserStatus, type CreateUserInput } from '../../lib/accountManagement';
import { useToast } from '../../components/Toast';
import type { AuthRole } from '../../lib/auth';

const TABS = ['All', 'Students', 'Faculty', 'Parents', 'Admins'] as const;

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  student:  { bg: 'rgba(91,79,232,0.10)',  color: '#5B4FE8' },
  faculty:  { bg: 'rgba(6,182,212,0.10)',  color: '#0891B2' },
  admin:    { bg: 'rgba(236,72,153,0.10)', color: '#DB2777' },
  parent:   { bg: 'rgba(245,158,11,0.10)', color: '#D97706' },
};
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Active:    { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  Inactive:  { bg: 'var(--surface-muted)',  color: 'var(--text-faint)' },
  Suspended: { bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' },
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  stream?: string;
  mustChangePassword?: boolean;
  lastActive?: { seconds: number } | string | null;
};

const PAGE_SIZE = 15;

const EMPTY_FORM: CreateUserInput = {
  name: '', email: '', role: 'student', stream: '', examTarget: '', linkedStudentId: '', facultyStream: '',
};

export default function UserManagement() {
  const toast = useToast();
  const [tab, setTab]         = useState<(typeof TABS)[number]>('All');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]       = useState<CreateUserInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [linkedStudentEmail, setLinkedStudentEmail] = useState('');

  async function loadUsers() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as UserRow))
          .filter(u => (u.email ?? '').endsWith('@conceptcrack.in'))
          .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
      );
    } catch {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u => {
      const roleMatch =
        tab === 'All'      ? true :
        tab === 'Students' ? u.role === 'student' :
        tab === 'Faculty'  ? u.role === 'faculty' :
        tab === 'Parents'  ? u.role === 'parent' :
        /* Admins */         u.role === 'admin';
      const textMatch = !q || `${u.name} ${u.email} ${u.role} ${u.status}`.toLowerCase().includes(q);
      return roleMatch && textMatch;
    });
  }, [users, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [tab, search]);

  // Metrics
  const counts = useMemo(() => ({
    total:   users.length,
    students: users.filter(u => u.role === 'student').length,
    faculty:  users.filter(u => u.role === 'faculty').length,
    parents:  users.filter(u => u.role === 'parent').length,
  }), [users]);

  const metricMeta = [
    { icon: 'group',      color: '#EC4899', bg: 'rgba(236,72,153,0.12)', label: 'Total Users',  value: String(counts.total)    },
    { icon: 'school',     color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)',  label: 'Students',     value: String(counts.students) },
    { icon: 'co_present', color: '#0891B2', bg: 'rgba(6,182,212,0.12)',  label: 'Faculty',      value: String(counts.faculty)  },
    { icon: 'family_restroom', color: '#D97706', bg: 'rgba(245,158,11,0.12)', label: 'Parents', value: String(counts.parents) },
  ];

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      let input: CreateUserInput = { ...form };
      // Resolve parent→student link by email
      if (form.role === 'parent' && linkedStudentEmail.trim()) {
        const q2 = query(collection(db, 'users'), where('email', '==', linkedStudentEmail.trim()), limit(1));
        const snap = await getDocs(q2);
        if (!snap.empty) input.linkedStudentId = snap.docs[0].id;
      }
      const { created } = await adminCreateUser(input);
      if (created) {
        toast(`Account created for ${form.name}. Temp password: Temp@1234`, 'success');
      } else {
        toast('Email already in use', 'error');
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setLinkedStudentEmail('');
      await loadUsers();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create account', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetSending(true);
    try {
      await adminResetPassword(resetTarget.email);
      toast(`Password reset email sent to ${resetTarget.email}`, 'success');
      setResetTarget(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send reset email', 'error');
    } finally {
      setResetSending(false);
    }
  }

  async function handleToggleStatus(u: UserRow) {
    const next = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await adminSetUserStatus(u.id, next as 'Active' | 'Inactive');
      setUsers(prev => prev.map(r => r.id === u.id ? { ...r, status: next } : r));
      toast(`${u.name} marked as ${next}`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
  }

  function formatLastActive(val: UserRow['lastActive']): string {
    if (!val) return '—';
    if (typeof val === 'object' && 'seconds' in val) {
      return new Date(val.seconds * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
    if (typeof val === 'string') return new Date(val).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    return '—';
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'User Management' }]}
        showSearch={false}
      />

      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              User Management
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              {counts.total} accounts — students, faculty, parents &amp; admins
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setLinkedStudentEmail(''); }}
            className="btn-primary btn-md flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Add User
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {metricMeta.map(m => (
            <div key={m.label} className="card">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: m.bg }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: m.color }}>{m.icon}</span>
              </div>
              <div className="text-2xl font-bold font-headline mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{m.value}</div>
              <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <Card noPad>
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="tab-pills">
              {TABS.map(t => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`tab-pill ${tab === t ? 'active' : ''}`}>{t}</button>
              ))}
            </div>
            <div className="ml-auto search-bar w-full sm:w-72">
              <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-faint)' }}>
              <span className="material-symbols-outlined animate-spin block mx-auto mb-2" style={{ fontSize: '24px' }}>progress_activity</span>
              Loading users…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Stream</th>
                    <th>Last Active</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(u => {
                    const roleStyle   = ROLE_BADGE[u.role]         ?? ROLE_BADGE.student;
                    const statusStyle = STATUS_BADGE[u.status ?? 'Active'] ?? STATUS_BADGE.Active;
                    const initials    = (u.name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="text-body-md font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                {u.name}
                                {u.mustChangePassword && (
                                  <span title="Must change password" className="material-symbols-outlined" style={{ fontSize: '14px', color: '#F59E0B' }}>lock_reset</span>
                                )}
                              </div>
                              <div className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge text-label-sm px-2.5 py-0.5 rounded-full font-semibold capitalize" style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className="text-body-md" style={{ color: 'var(--text-secondary)' }}>{u.stream ?? '—'}</span>
                        </td>
                        <td>
                          <span className="text-body-md" style={{ color: 'var(--text-muted)' }}>{formatLastActive(u.lastActive)}</span>
                        </td>
                        <td>
                          <span className="badge text-label-sm px-2.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                            {u.status ?? 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="icon-btn icon-btn-sm"
                              title="Send password reset email"
                              onClick={() => setResetTarget(u)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock_reset</span>
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-sm"
                              title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleStatus(u)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: u.status === 'Active' ? '#EF4444' : '#10B981' }}>
                                {u.status === 'Active' ? 'person_off' : 'person_check'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10" style={{ color: 'var(--text-faint)' }}>
                        {loading ? 'Loading…' : 'No users found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <span className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              {totalPages > 1 && ` · page ${page} of ${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="icon-btn icon-btn-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page - 2 + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-md text-sm font-semibold transition-colors"
                      style={p === page ? { backgroundColor: '#EC4899', color: '#fff' } : { color: 'var(--text-muted)' }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="icon-btn icon-btn-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Add User Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-headline-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
                Add New User
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="icon-btn icon-btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div className="rounded-xl p-3 text-sm flex gap-2.5" style={{ backgroundColor: 'rgba(91,79,232,0.08)', border: '1px solid rgba(91,79,232,0.15)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: '16px', color: '#5B4FE8' }}>info</span>
              <span style={{ color: 'var(--text-secondary)' }}>Password will be <strong>Temp@1234</strong> — user must change it on first login.</span>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              {/* Name */}
              <FormField label="Full Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Arjun Sharma"
                  required
                />
              </FormField>

              {/* Email */}
              <FormField label="Email" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. student.arjun@conceptcrack.in"
                  required
                />
              </FormField>

              {/* Role */}
              <FormField label="Role" required>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as AuthRole, stream: '', examTarget: '', facultyStream: '' }))}
                >
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </FormField>

              {/* Student fields */}
              {form.role === 'student' && (
                <>
                  <FormField label="Stream">
                    <select value={form.stream} onChange={e => setForm(f => ({ ...f, stream: e.target.value }))}>
                      <option value="">— Select —</option>
                      <option value="JEE">JEE</option>
                      <option value="NEET">NEET</option>
                    </select>
                  </FormField>
                  <FormField label="Exam Target">
                    <input
                      type="text"
                      value={form.examTarget}
                      onChange={e => setForm(f => ({ ...f, examTarget: e.target.value }))}
                      placeholder="e.g. JEE 2026"
                    />
                  </FormField>
                </>
              )}

              {/* Parent fields */}
              {form.role === 'parent' && (
                <FormField label="Linked Student Email">
                  <input
                    type="email"
                    value={linkedStudentEmail}
                    onChange={e => setLinkedStudentEmail(e.target.value)}
                    placeholder="student.name@conceptcrack.in"
                  />
                </FormField>
              )}

              {/* Faculty fields */}
              {form.role === 'faculty' && (
                <FormField label="Faculty Stream">
                  <select value={form.facultyStream} onChange={e => setForm(f => ({ ...f, facultyStream: e.target.value }))}>
                    <option value="">— Select —</option>
                    <option value="JEE">JEE Batch</option>
                    <option value="NEET">NEET Batch</option>
                  </select>
                </FormField>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 btn-outline btn-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.name || !form.email}
                  className="flex-1 btn-primary btn-md flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
                >
                  {creating
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span> Create Account</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Confirmation ── */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setResetTarget(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#F59E0B' }}>lock_reset</span>
            </div>
            <div className="text-center">
              <h2 className="text-headline-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Reset Password?</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                A password reset link will be sent to<br />
                <strong style={{ color: 'var(--text-primary)' }}>{resetTarget.email}</strong>
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setResetTarget(null)} className="flex-1 btn-outline btn-md">Cancel</button>
              <button
                type="button"
                disabled={resetSending}
                onClick={handleResetPassword}
                className="flex-1 btn-primary btn-md flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
              >
                {resetSending
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
                  : 'Send Reset Email'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}{required && <span style={{ color: '#EF4444' }}> *</span>}
      </span>
      <div
        className="[&>input]:w-full [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-sm [&>select]:w-full [&>select]:bg-transparent [&>select]:outline-none [&>select]:text-sm"
        style={{
          backgroundColor: 'var(--surface-muted)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '8px 12px',
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </div>
    </label>
  );
}
