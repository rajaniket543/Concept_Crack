import { useState, type FormEvent } from 'react';
import Spinner from '../components/Spinner';
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

interface Rule { ok: boolean; label: string; }

function passwordRules(pw: string): Rule[] {
  return [
    { ok: pw.length >= 8,          label: '8+ characters' },
    { ok: /[A-Z]/.test(pw),        label: 'Uppercase letter' },
    { ok: /[a-z]/.test(pw),        label: 'Lowercase letter' },
    { ok: /[0-9]/.test(pw),        label: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(pw), label: 'Special character' },
  ];
}

export default function ChangePassword() {
  const navigate   = useNavigate();
  const toast      = useToast();
  const { isDark } = useTheme();
  const session    = getAuthSession();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw,      setNewPw]     = useState('');
  const [confirmPw,  setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConf,    setShowConf]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [formError,   setFormError]   = useState('');

  const rules       = passwordRules(newPw);
  const allRulesMet = rules.every(r => r.ok);
  const mismatch    = confirmPw.length > 0 && newPw !== confirmPw;
  const sameAsOld   = newPw.length > 0 && currentPw.length > 0 && newPw === currentPw;

  const strengthScore = rules.filter(r => r.ok).length; // 0-5
  const strengthLabel = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Medium' : 'Strong';
  const strengthColor = strengthScore <= 2 ? '#EF4444' : strengthScore <= 4 ? '#F59E0B' : '#10B981';

  const canSubmit =
    !loading &&
    currentPw.length > 0 &&
    allRulesMet &&
    newPw === confirmPw &&
    newPw !== currentPw;

  const bg    = isDark ? '#0F0E17' : '#FAFAFA';
  const card  = isDark ? '#1E1D2E' : '#FFFFFF';
  const bdr   = isDark ? '#2D2B42' : '#E5E7EB';
  const txt   = isDark ? '#F9FAFB' : '#111827';
  const muted = isDark ? '#9CA3AF' : '#6B7280';
  const lbl   = isDark ? '#D1D5DB' : '#374151';

  const fieldWrap: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    height: 44, padding: '0 14px', borderRadius: 12,
    backgroundColor: card, border: `1px solid ${bdr}`, transition: 'all 0.15s',
  };

  function focusRing(e: React.FocusEvent) {
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = 'var(--brand)';
    el.style.boxShadow   = '0 0 0 3px rgba(107,94,240,0.12)';
  }
  function blurRing(e: React.FocusEvent) {
    const el = e.currentTarget as HTMLElement;
    el.style.borderColor = bdr;
    el.style.boxShadow   = 'none';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!canSubmit) return;

    setLoading(true);
    try {
      await completePasswordChange(currentPw, newPw);

      // Clear the flag on the LOCAL session immediately — the route guard
      // reads this from localStorage, not Firestore, so without this the
      // very next navigation would bounce the user right back here.
      if (session) {
        session.user.mustChangePassword = false;
        session.redirectTo = ROLE_PATH[session.user.role] ?? '/login';
        setAuthSession(session);
      }

      toast('Password updated! Welcome to Concept Crack.', 'success');
      navigate(ROLE_PATH[session?.user?.role ?? 'student'] ?? '/login', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set password';
      if (msg.includes('sign in again')) {
        toast('Session expired — please sign in again.', 'error');
        navigate('/login', { replace: true });
      } else {
        setFormError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function passwordField(opts: {
    id: string; label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggleShow: () => void; placeholder: string; error?: string;
  }) {
    return (
      <div>
        <label htmlFor={opts.id} className="block text-sm font-medium mb-1.5" style={{ color: lbl }}>
          {opts.label}
        </label>
        <div style={fieldWrap} onFocusCapture={focusRing} onBlurCapture={blurRing}>
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: muted }}>lock</span>
          <input
            id={opts.id}
            type={opts.show ? 'text' : 'password'}
            value={opts.value}
            onChange={e => opts.onChange(e.target.value)}
            placeholder={opts.placeholder}
            autoComplete={opts.id === 'current-pw' ? 'current-password' : 'new-password'}
            style={{ flex: 1, background: 'transparent', outline: 'none', fontSize: 14, color: txt }}
          />
          <button type="button" tabIndex={-1} onClick={opts.onToggleShow} style={{ color: muted, lineHeight: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {opts.show ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
        {opts.error && <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>{opts.error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: bg }}>
      <div className="w-full max-w-[400px]">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>lock_reset</span>
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: txt }}>
              Change your password
            </h1>
            <p className="text-sm" style={{ color: muted }}>
              {session?.user?.name ? `Hi ${session.user.name.split(' ')[0]}! ` : ''}You must set a new password before continuing.
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'rgba(107,94,240,0.08)', border: '1px solid rgba(107,94,240,0.20)' }}>
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: 'var(--brand)', marginTop: 1 }}>info</span>
          <p className="text-sm" style={{ color: isDark ? '#C4B5FD' : 'var(--brand)' }}>
            Your account was set up with a temporary password. This step is required and can't be skipped.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">

          {passwordField({
            id: 'current-pw', label: 'Current Password', value: currentPw,
            onChange: setCurrentPw, show: showCurrent, onToggleShow: () => setShowCurrent(v => !v),
            placeholder: 'Your temporary password',
          })}

          {passwordField({
            id: 'new-pw', label: 'New Password', value: newPw,
            onChange: setNewPw, show: showNew, onToggleShow: () => setShowNew(v => !v),
            placeholder: 'Create a new password',
            error: sameAsOld ? 'New password must be different from your current password.' : undefined,
          })}

          {passwordField({
            id: 'conf-pw', label: 'Confirm New Password', value: confirmPw,
            onChange: setConfirmPw, show: showConf, onToggleShow: () => setShowConf(v => !v),
            placeholder: 'Repeat your new password',
            error: mismatch ? 'Passwords do not match.' : undefined,
          })}

          {/* Strength bar */}
          {newPw.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: muted }}>Password strength</span>
                <span className="text-xs font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bdr }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(strengthScore / 5) * 100}%`, backgroundColor: strengthColor }}
                />
              </div>
            </div>
          )}

          {/* Strength hints */}
          <div className="grid grid-cols-2 gap-2">
            {rules.map(hint => (
              <div key={hint.label} className="flex items-center gap-1.5">
                <span className="material-symbols-outlined"
                  style={{ fontSize: '14px', color: hint.ok ? '#10B981' : (isDark ? '#4B5563' : '#D1D5DB') }}>
                  {hint.ok ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className="text-xs" style={{ color: hint.ok ? '#10B981' : muted }}>{hint.label}</span>
              </div>
            ))}
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: '16px', color: '#EF4444', marginTop: 1 }}>error</span>
              <p className="text-xs" style={{ color: '#EF4444' }}>{formError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
            style={{ background: 'linear-gradient(135deg, var(--brand), #7C3AED)', boxShadow: '0 4px 12px rgba(107,94,240,0.35)' }}
          >
            {loading
              ? <><Spinner size={16} /> Saving…</>
              : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span> Change Password &amp; Continue</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
