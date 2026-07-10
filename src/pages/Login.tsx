import { FormEvent, KeyboardEvent, useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  login as authLogin,
  forgotPassword,
  verifyResetCode,
  completePasswordReset,
} from '../lib/auth';
import { LoginRole, pathFor } from '../lib/pages';
import Spinner from '../components/Spinner';

const SUPPORT_EMAIL = 'support@conceptcrack.app';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type View = 'login' | 'forgot' | 'forgotSent' | 'reset' | 'resetDone';

const roleDefs: { key: LoginRole; label: string; icon: string }[] = [
  { key: 'student', label: 'Student',  icon: 'school' },
  { key: 'parent',  label: 'Parent',   icon: 'family_restroom' },
  { key: 'faculty', label: 'Faculty',  icon: 'co_present' },
  { key: 'admin',   label: 'Admin',    icon: 'admin_panel_settings' },
];

const leftPanelFeatures = [
  { icon: 'psychology', label: 'AI Adaptive Learning', desc: 'Personalized to your strengths & gaps' },
  { icon: 'analytics',  label: 'Real-time Analytics',  desc: 'Deep insights into your performance' },
  { icon: 'quiz',       label: 'Smart Mock Tests',      desc: 'Full-length tests with anti-cheat' },
];

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [view, setView] = useState<View>('login');
  const [role, setRole] = useState<LoginRole>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [capsLock, setCapsLock] = useState(false);

  // Forgot-password flow state
  const [forgotEmail, setForgotEmail] = useState('');
  // In-app reset (arrives via the emailed secure link)
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const trimmedId = identifier.trim();
  const emailLooksValid = EMAIL_REGEX.test(trimmedId);
  const canSubmit = !loading && trimmedId.length > 0 && emailLooksValid && password.length > 0;

  // If the secure reset link from the email opens back in the app
  // (?mode=resetPassword&oobCode=…), complete the reset right here.
  useEffect(() => {
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'resetPassword' && oobCode) {
      setLoading(true);
      verifyResetCode(oobCode)
        .then(email => {
          setResetCode(oobCode);
          setResetEmail(email);
          setView('reset');
        })
        .catch(() => setErrorMessage('This reset link is invalid or has expired. Request a new one below.'))
        .finally(() => setLoading(false));
    }
  }, [params]);

  function detectCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  }

  function clearMessages() {
    setStatusMessage(null);
    setErrorMessage(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      const session = await authLogin({ identifier, password, role });
      navigate(session.redirectTo);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onForgotSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!EMAIL_REGEX.test(forgotEmail.trim())) {
      setErrorMessage('Enter a valid email address.');
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      await forgotPassword(forgotEmail);
      setView('forgotSent');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to send the reset email.');
    } finally {
      setLoading(false);
    }
  }

  async function onResetSubmit(e: FormEvent<FormEvent | HTMLFormElement>) {
    e.preventDefault();
    if (newPassword.length < 8) { setErrorMessage('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmNew) { setErrorMessage('Passwords do not match.'); return; }
    if (!resetCode) return;
    setLoading(true);
    clearMessages();
    try {
      await completePasswordReset(resetCode, newPassword);
      setView('resetDone');
      setStatusMessage('Password changed. Sign in with your new password.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not change the password. Request a new link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen grid lg:grid-cols-[40%_60%]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF', color: '#111827' }}
    >
      {/* ── Left panel ── */}
      <aside
        className="hidden lg:flex flex-col justify-between p-10 xl:p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0E17 0%, #1A1929 100%)' }}
      >
        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-20 -left-10 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} />
          <div className="absolute bottom-20 right-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
          <div className="absolute top-1/2 right-10 w-32 h-32 rounded-full blur-2xl opacity-15" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} />
        </div>

        {/* Full-bleed hero photo covering the left half. */}
        <img
          src="/login-hero.jpg"
          alt=""
          aria-hidden="true"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
          style={{ objectPosition: 'center' }}
        />
        {/* Dark overlay so the headline and features stay readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'linear-gradient(160deg, rgba(15,14,23,0.90) 0%, rgba(26,25,41,0.78) 55%, rgba(15,14,23,0.92) 100%)' }}
        />

        <div className="relative max-w-[460px]">
          <Link to={pathFor('landing')} className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Concept Crack" className="w-11 h-11 rounded-xl object-cover" />
            <span className="font-bold text-white text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Concept Crack</span>
          </Link>
        </div>

        <div className="relative max-w-[460px] pb-6">
          <h2 className="text-2xl xl:text-[2.15rem] font-bold leading-tight text-white mb-2.5" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>
            Your path to the<br />top rank starts here
          </h2>
          <p className="text-xs xl:text-sm mb-8" style={{ color: '#9CA3AF' }}>
            AI-powered preparation for JEE, NEET, UPSC, and CAT.
          </p>
          <div className="space-y-3.5">
            {leftPanelFeatures.map(feat => (
              <div key={feat.label} className="flex items-center gap-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(91,79,232,0.20)', border: '1px solid rgba(91,79,232,0.30)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#818CF8' }}>{feat.icon}</span>
                </div>
                <div>
                  <div className="text-xs xl:text-sm font-semibold text-white">{feat.label}</div>
                  <div className="text-[11px] xl:text-xs" style={{ color: '#6B7280' }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="relative flex items-center justify-center p-6 lg:p-10 xl:p-12" style={{ backgroundColor: '#FAFAFA' }}>
        <Link
          to={pathFor('landing')}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
          style={{ backgroundColor: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
          About Us
        </Link>
        <div
          className="w-full max-w-[620px] rounded-[32px] p-6 sm:p-8 lg:p-10"
          style={{
            backgroundColor: 'rgba(255,255,255,0.86)',
            border: '1px solid #E5E7EB',
            boxShadow: '0 24px 80px rgba(17,24,39,0.08)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link to={pathFor('landing')} className="inline-flex items-center gap-2">
              <img src="/logo.png" alt="Concept Crack" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-bold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#111827' }}>Concept Crack</span>
            </Link>
          </div>

          {/* ═══ SIGN IN ═══ */}
          {view === 'login' && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#111827' }}>
                Welcome back
              </h1>
              <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>
                Sign in to continue your preparation
              </p>

              {/* Role selector */}
              <div
                className="grid grid-cols-4 gap-1.5 p-1.5 rounded-xl mb-6"
                style={{ backgroundColor: '#F3F4F6' }}
                role="tablist"
              >
                {roleDefs.map(r => {
                  const active = role === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setRole(r.key); clearMessages(); }}
                      className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-lg text-xs font-semibold transition-all duration-150"
                      style={active
                        ? { backgroundColor: '#5B4FE8', color: '#fff', boxShadow: '0 2px 8px rgba(91,79,232,0.30)' }
                        : { color: '#6B7280', backgroundColor: 'transparent' }
                      }
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{r.icon}</span>
                      {r.label}
                    </button>
                  );
                })}
              </div>

              <Messages status={statusMessage} error={errorMessage} />

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <InputField
                    label="Email address"
                    type="email"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    icon="mail"
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={trimmedId.length > 0 && !emailLooksValid}
                  />
                  {!emailLooksValid && trimmedId.length > 0 && (
                    <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>Enter a valid email address.</p>
                  )}
                </div>
                <div>
                  <InputField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyUp={detectCapsLock}
                    onKeyDown={detectCapsLock}
                    icon="lock"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-black/5"
                        style={{ color: '#9CA3AF' }}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    }
                  />
                  {capsLock && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>keyboard_capslock</span>
                      Caps Lock is on
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6B7280' }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="rounded border"
                      style={{ accentColor: '#5B4FE8' }}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setForgotEmail(trimmedId); clearMessages(); }}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: '#5B4FE8' }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
                  style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
                >
                  {loading ? <Spinner size={16} /> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {/* ═══ FORGOT PASSWORD — step 1: email ═══ */}
          {view === 'forgot' && (
            <>
              <BackToLogin onClick={() => { setView('login'); clearMessages(); }} />
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#111827' }}>
                Reset your password
              </h1>
              <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>
                Enter your account email. We'll send a secure one-time link — open it and you'll set a new password right here.
              </p>

              <Messages status={statusMessage} error={errorMessage} />

              <form onSubmit={onForgotSubmit} className="space-y-4">
                <InputField
                  label="Email address"
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  icon="mail"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={loading || !EMAIL_REGEX.test(forgotEmail.trim())}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
                >
                  {loading ? <Spinner size={16} /> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              {/* Procedure explainer */}
              <ol className="mt-6 space-y-2">
                {[
                  'We email a secure one-time link to your address.',
                  'Open the link — it verifies you and brings you back here.',
                  'Choose a new password and sign in.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs" style={{ color: '#6B7280' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8' }}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}

          {/* ═══ FORGOT PASSWORD — step 2: sent ═══ */}
          {view === 'forgotSent' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#059669' }}>mark_email_read</span>
              </div>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#111827' }}>
                Check your inbox
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
                A secure reset link is on its way to <strong style={{ color: '#111827' }}>{forgotEmail}</strong>.
                Open it to verify it's you, then set your new password here. The link expires in about an hour.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => { setView('login'); clearMessages(); }}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="w-full h-11 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
                >
                  Didn't get it? Send again
                </button>
              </div>
            </>
          )}

          {/* ═══ RESET — set the new password (arrived via emailed link) ═══ */}
          {view === 'reset' && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#111827' }}>
                Set a new password
              </h1>
              <p className="text-sm mb-7" style={{ color: '#9CA3AF' }}>
                Verified — you're changing the password for <strong style={{ color: '#111827' }}>{resetEmail}</strong>.
              </p>

              <Messages status={statusMessage} error={errorMessage} />

              <form onSubmit={onResetSubmit} className="space-y-4">
                <InputField
                  label="New password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  icon="lock_reset"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-black/5"
                      style={{ color: '#9CA3AF' }}
                      tabIndex={-1}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  }
                />
                <InputField
                  label="Confirm new password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmNew}
                  onChange={e => setConfirmNew(e.target.value)}
                  icon="lock"
                  placeholder="Repeat the new password"
                  autoComplete="new-password"
                />
                <button
                  type="submit"
                  disabled={loading || newPassword.length === 0 || confirmNew.length === 0}
                  className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
                >
                  {loading ? <Spinner size={16} /> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>}
                  {loading ? 'Saving…' : 'Change password'}
                </button>
              </form>
            </>
          )}

          {/* ═══ RESET DONE ═══ */}
          {view === 'resetDone' && (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#059669' }}>task_alt</span>
              </div>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#111827' }}>
                Password changed
              </h1>
              <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
                Your password has been updated. Sign in with the new password to continue.
              </p>
              <button
                type="button"
                onClick={() => { setView('login'); clearMessages(); navigate('/login', { replace: true }); }}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>
                Back to sign in
              </button>
            </>
          )}

          {view === 'login' && (
            <p className="text-xs text-center mt-4" style={{ color: '#9CA3AF' }}>
              Trouble signing in?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold hover:underline" style={{ color: '#5B4FE8' }}>Contact admin</a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Messages({ status, error }: { status: string | null; error: string | null }) {
  return (
    <>
      {status && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669' }}>
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }}>check_circle</span>
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
          <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }}>error</span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

function BackToLogin({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-semibold mb-5 hover:underline"
      style={{ color: '#6B7280' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
      Back to sign in
    </button>
  );
}

function InputField({
  label, icon, trailing, ...input
}: { label: string; icon: string; trailing?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{label}</span>
      <div
        className="flex items-center gap-2.5 h-11 pl-3.5 pr-1.5 rounded-xl transition-all duration-150"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
        }}
        onFocusCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = '#5B4FE8';
          el.style.boxShadow = '0 0 0 3px rgba(91,79,232,0.12)';
        }}
        onBlurCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = '#E5E7EB';
          el.style.boxShadow = 'none';
        }}
      >
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: '#9CA3AF' }}>{icon}</span>
        <input
          {...input}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: '#111827', minWidth: 0 }}
        />
        {trailing}
      </div>
    </label>
  );
}
