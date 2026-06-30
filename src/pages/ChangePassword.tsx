import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { completePasswordChange } from '../lib/accountManagement';
import { getAuthSession, setAuthSession } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useToast } from '../components/Toast';

const ROLE_PATH: Record<string, string> = {
  student: '/student',
  parent:  '/parent',
  faculty: '/faculty',
  admin:   '/admin',
};

export default function ChangePassword() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { isDark } = useTheme();
  const session   = getAuthSession();

  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew,   setShowNew]   = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [loading,   setLoading]   = useState(false);

  const mismatch    = confirmPw.length > 0 && newPw !== confirmPw;
  const tooShort    = newPw.length > 0 && newPw.length < 8;
  const canSubmit   = !loading && newPw.length >= 8 && newPw === confirmPw;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await completePasswordChange(newPw);
      // Update session redirectTo so back-navigation doesn't loop
      if (session) {
        const role = session.user.role;
        session.redirectTo = ROLE_PATH[role] ?? '/login';
        setAuthSession(session);
      }
      toast('Password set! Welcome to Concept Crack.', 'success');
      navigate(ROLE_PATH[session?.user?.role ?? 'student'] ?? '/login', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set password';
      if (msg.includes('requires-recent-login') || msg.includes('CREDENTIAL_TOO_OLD')) {
        toast('Session expired — please sign in again.', 'error');
        navigate('/login', { replace: true });
      } else {
        toast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const bg   = isDark ? '#0F0E17' : '#FAFAFA';
  const card = isDark ? '#1E1D2E' : '#FFFFFF';
  const bdr  = isDark ? '#2D2B42' : '#E5E7EB';
  const txt  = isDark ? '#F9FAFB' : '#111827';
  const muted = isDark ? '#9CA3AF' : '#6B7280';
  const label = isDark ? '#D1D5DB' : '#374151';

  function PwField({
    value, onChange, show, onToggle, placeholder, id,
  }: {
    value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void;
    placeholder: string; id: string;
  }) {
    return (
      <div
        className="flex items-center gap-2.5 h-11 px-3.5 rounded-xl transition-all"
        style={{ backgroundColor: card, border: `1px solid ${bdr}` }}
        onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#5B4FE8'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(91,79,232,0.12)'; }}
        onBlurCapture={e  => { (e.currentTarget as HTMLElement).style.borderColor = bdr;      (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      >
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: muted }}>lock</span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: txt }}
          autoComplete="new-password"
        />
        <button type="button" onClick={onToggle} tabIndex={-1} style={{ color: muted }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bg }}>
      <div className="w-full max-w-[400px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>lock_reset</span>
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: txt }}>
              Set your password
            </h1>
            <p className="text-sm" style={{ color: muted }}>
              {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}! ` : ''}Choose a strong password to continue.
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div
          className="flex items-start gap-3 rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'rgba(91,79,232,0.08)', border: '1px solid rgba(91,79,232,0.20)' }}
        >
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: '#5B4FE8', marginTop: 1 }}>info</span>
          <p className="text-sm" style={{ color: isDark ? '#C4B5FD' : '#5B4FE8' }}>
            Your account was set up with a temporary password. Set a new one to proceed — you'll only see this once.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium mb-1.5" style={{ color: label }}>
              New Password
            </label>
            <PwField
              id="new-pw"
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              onToggle={() => setShowNew(v => !v)}
              placeholder="Min 8 characters"
            />
            {tooShort && (
              <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>Password must be at least 8 characters</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="conf-pw" className="block text-sm font-medium mb-1.5" style={{ color: label }}>
              Confirm Password
            </label>
            <PwField
              id="conf-pw"
              value={confirmPw}
              onChange={setConfirmPw}
              show={showConf}
              onToggle={() => setShowConf(v => !v)}
              placeholder="Repeat your password"
            />
            {mismatch && (
              <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>Passwords do not match</p>
            )}
          </div>

          {/* Strength hints */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { ok: newPw.length >= 8,           label: '8+ characters' },
              { ok: /[A-Z]/.test(newPw),         label: 'Uppercase letter' },
              { ok: /[0-9]/.test(newPw),         label: 'Number' },
              { ok: /[^A-Za-z0-9]/.test(newPw),  label: 'Special character' },
            ].map(hint => (
              <div key={hint.label} className="flex items-center gap-1.5">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '14px', color: hint.ok ? '#10B981' : (isDark ? '#4B5563' : '#D1D5DB') }}
                >
                  {hint.ok ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className="text-xs" style={{ color: hint.ok ? '#10B981' : muted }}>{hint.label}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
          >
            {loading
              ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span> Saving…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span> Set Password & Continue</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
