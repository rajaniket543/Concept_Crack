import { FormEvent, KeyboardEvent, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  login as authLogin,
  forgotPassword,
  verifyResetCode,
  completePasswordReset,
} from '../lib/auth';
import { LoginRole, pathFor } from '../lib/pages';
import Spinner from '../components/Spinner';
import Logo from '../components/Logo';
import { useTheme } from '../lib/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type View = 'login' | 'forgot' | 'forgotSent' | 'reset' | 'resetDone';

const roleDefs: { key: LoginRole; label: string; icon: string }[] = [
  { key: 'student', label: 'Student',  icon: 'school' },
  { key: 'parent',  label: 'Parent',   icon: 'family_restroom' },
  { key: 'faculty', label: 'Faculty',  icon: 'co_present' },
  { key: 'admin',   label: 'Admin',    icon: 'admin_panel_settings' },
];

const introPoints = [
  { icon: 'psychology', text: 'AI understands your learning journey.' },
  { icon: 'bar_chart',  text: 'Every mistake becomes an opportunity.' },
  { icon: 'schedule',   text: 'Study smarter. Progress every single day.' },
];

// Stable random ambient-particle layout, generated once per mount.
function useParticles(count: number, opacity: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: 20 + Math.random() * 70,
        size: 2 + Math.random() * 3,
        duration: 14 + Math.random() * 12,
        delay: Math.random() * 10,
        opacity,
      })),
    [count, opacity],
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();

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

  const leftParticles = useParticles(14, 0.55);
  const rightParticles = useParticles(6, 0.35);

  // Theme-aware tokens for the right (form) panel. The left intro panel stays
  // permanently dark (brand hero), matching how it's always styled elsewhere.
  const t = isDark
    ? {
        panelBg:    '#0B0B13',
        cardBg:     'rgba(23,23,34,0.72)',
        cardBorder: 'rgba(255,255,255,0.06)',
        cardShadow: '0 24px 60px rgba(0,0,0,0.45)',
        heading:    '#FFFFFF',
        sub:        '#A1A1AA',
        label:      '#A1A1AA',
        muted:      '#A1A1AA',
        inputBg:    '#1D1D2E',
        inputBorder:'rgba(255,255,255,0.06)',
        icon:       '#A1A1AA',
      }
    : {
        panelBg:    '#FAFAFA',
        cardBg:     'rgba(255,255,255,0.86)',
        cardBorder: '#E5E7EB',
        cardShadow: '0 24px 60px rgba(17,24,39,0.10)',
        heading:    '#111827',
        sub:        '#6B7280',
        label:      '#374151',
        muted:      '#6B7280',
        inputBg:    '#FFFFFF',
        inputBorder:'#E5E7EB',
        icon:       '#9CA3AF',
      };

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

  async function onResetSubmit(e: FormEvent<HTMLFormElement>) {
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
      className="min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[40%_60%]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <style>{`
        @keyframes loginFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes loginMeshDrift { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-2%, 2%) scale(1.06); } }
        @keyframes loginMeshDriftR { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(3%, -2%) scale(1.05); } }
        @keyframes loginParticleFloat { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: var(--p-op, 0.5); } 90% { opacity: calc(var(--p-op, 0.5) * 0.7); } 100% { transform: translateY(-90px) translateX(12px); opacity: 0; } }
        @keyframes loginCardIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes loginPulseGlow { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes loginBreathe { 0%, 100% { box-shadow: 0 8px 24px rgba(139,92,246,0.3); } 50% { box-shadow: 0 8px 30px rgba(139,92,246,0.42); } }
        .login-particle { position: absolute; border-radius: 9999px; background: radial-gradient(circle, rgba(139,92,246,0.65), rgba(139,92,246,0) 70%); animation: loginParticleFloat linear infinite; }
      `}</style>

      {/* ── Left panel: emotional intro, always dark ── */}
      <aside
        className="relative flex flex-col justify-between overflow-hidden p-8 lg:p-12 min-h-[280px] lg:min-h-0"
        style={{
          background:
            'radial-gradient(circle at 18% 8%, rgba(37,99,235,0.16), transparent 45%), radial-gradient(circle at 78% 88%, rgba(139,92,246,0.18), transparent 50%), linear-gradient(160deg, #0D0D18 0%, #0B0B13 55%, #0A0A11 100%)',
        }}
      >
        {/* Drifting mesh glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: '-10%',
            background:
              'radial-gradient(ellipse 500px 400px at 30% 20%, rgba(37,99,235,0.10), transparent 60%), radial-gradient(ellipse 460px 380px at 75% 65%, rgba(139,92,246,0.12), transparent 60%), radial-gradient(ellipse 380px 340px at 15% 85%, rgba(56,189,248,0.06), transparent 60%)',
            filter: 'blur(40px)',
            animation: 'loginMeshDrift 22s ease-in-out infinite alternate',
          }}
          aria-hidden="true"
        />
        {/* Ambient particles */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {leftParticles.map((p, i) => (
            <div
              key={i}
              className="login-particle"
              style={{
                width: p.size, height: p.size,
                left: `${p.left}%`, top: `${p.top}%`,
                animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
                ['--p-op' as any]: p.opacity,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative shrink-0 z-[2]">
          <Link to={pathFor('landing')} className="inline-flex items-center">
            <Logo size="lg" tone="onDark" />
          </Link>
        </div>

        {/* Headline + points */}
        <div className="relative flex-1 flex flex-col justify-center max-w-[460px] py-8 lg:py-0 z-[2]">
          <h1
            className="font-bold leading-[1.18] mb-4 text-white"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(28px, 3vw, 38px)', letterSpacing: '-0.6px' }}
          >
            Your preparation deserves<br />
            <span style={{ background: 'linear-gradient(90deg, #2563EB, var(--violet))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              more than practice.
            </span>
          </h1>
          <p className="text-[13.5px] leading-relaxed max-w-[400px]" style={{ color: '#A1A1AA' }}>
            Every session should make you better than yesterday — not just busier.
          </p>

          <div className="hidden lg:flex flex-col gap-3.5 mt-8">
            {introPoints.map(pt => (
              <div key={pt.text} className="flex items-center gap-3">
                <div
                  className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(139,92,246,0.12)', boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.18)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--violet)' }}>{pt.icon}</span>
                </div>
                <div className="text-[13px] font-semibold text-white">{pt.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-[2]">
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full w-fit"
            style={{ color: 'var(--violet)', backgroundColor: 'rgba(139,92,246,0.1)', boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.2)' }}
          >
            JEE · NEET
          </div>
        </div>
      </aside>

      {/* ── Right panel: auth card ── */}
      <main
        className="relative flex items-center justify-center overflow-hidden p-6 lg:p-10 xl:p-12"
        style={{ backgroundColor: t.panelBg }}
      >
        {/* Ambient mesh + glow, theme-independent (card floats above it) */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: '-15%',
            background:
              'radial-gradient(ellipse 480px 380px at 70% 25%, rgba(139,92,246,0.09), transparent 60%), radial-gradient(ellipse 420px 360px at 25% 80%, rgba(37,99,235,0.08), transparent 60%)',
            filter: 'blur(50px)',
            animation: 'loginMeshDriftR 26s ease-in-out infinite alternate',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 45%, rgba(139,92,246,0.06), transparent 55%)',
            animation: 'loginPulseGlow 6s ease-in-out infinite',
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {rightParticles.map((p, i) => (
            <div
              key={i}
              className="login-particle"
              style={{
                width: p.size, height: p.size,
                left: `${p.left}%`, top: `${p.top}%`,
                animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
                ['--p-op' as any]: p.opacity,
              }}
            />
          ))}
        </div>

        {/* Top-right controls: theme toggle + About */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-[3]">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ backgroundColor: t.inputBg, color: t.muted, border: `1px solid ${t.cardBorder}` }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <Link
            to={pathFor('landing')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
            style={{ backgroundColor: t.inputBg, color: t.muted, border: `1px solid ${t.cardBorder}` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
            About Us
          </Link>
        </div>

        <div
          className="relative z-[2] w-full max-w-[560px] rounded-[20px] p-8 sm:p-10 lg:p-12"
          style={{
            backgroundColor: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            boxShadow: t.cardShadow,
            backdropFilter: 'blur(20px)',
            animation: 'loginCardIn 0.7s cubic-bezier(.2,.8,.2,1) 0.1s both',
          }}
        >
          {/* ═══ SIGN IN ═══ */}
          {view === 'login' && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.heading }}>
                Welcome back, future topper.
              </h1>
              <p className="text-sm mb-6" style={{ color: t.sub }}>
                Continue your AI-powered preparation.
              </p>

              {/* Role selector */}
              <div className="grid grid-cols-4 gap-2 mb-5" role="tablist">
                {roleDefs.map(r => {
                  const active = role === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setRole(r.key); clearMessages(); }}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-xl transition-all duration-200"
                      style={active
                        ? {
                            background: 'linear-gradient(160deg, rgba(139,92,246,0.22), rgba(37,99,235,0.14))',
                            boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.4), 0 0 24px rgba(139,92,246,0.18)',
                          }
                        : { backgroundColor: t.inputBg, border: `1px solid ${t.inputBorder}` }
                      }
                      onMouseEnter={e => { if (!active) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '17px', color: active ? 'var(--violet)' : t.icon, opacity: active ? 1 : 0.75 }}>{r.icon}</span>
                      <span className="text-[11px] font-semibold" style={{ color: active ? t.heading : t.muted }}>{r.label}</span>
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
                    tokens={t}
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
                    tokens={t}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-black/5"
                        style={{ color: t.icon }}
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
                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer" style={{ color: t.muted }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="rounded border"
                      style={{ accentColor: 'var(--violet)' }}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setForgotEmail(trimmedId); clearMessages(); }}
                    className="text-xs font-semibold hover:underline"
                    style={{ color: t.muted }}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 rounded-[13px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none disabled:hover:translate-y-0 mt-2"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, var(--violet))',
                    animation: loading ? undefined : 'loginBreathe 4s ease-in-out 1.1s infinite',
                  }}
                >
                  {loading ? <Spinner size={16} /> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <p className="text-xs text-center mt-4" style={{ color: t.sub }}>
                Need help?{' '}
                <Link to={pathFor('contact')} className="font-semibold hover:underline" style={{ color: 'var(--cyan)' }}>Contact Administrator</Link>
              </p>
            </>
          )}

          {/* ═══ FORGOT PASSWORD — step 1: email ═══ */}
          {view === 'forgot' && (
            <>
              <BackToLogin onClick={() => { setView('login'); clearMessages(); }} color={t.muted} />
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.heading }}>
                Reset your password
              </h1>
              <p className="text-sm mb-7" style={{ color: t.sub }}>
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
                  tokens={t}
                />
                <button
                  type="submit"
                  disabled={loading || !EMAIL_REGEX.test(forgotEmail.trim())}
                  className="w-full h-11 rounded-[13px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #2563EB, var(--violet))' }}
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
                  <li key={i} className="flex items-start gap-2.5 text-xs" style={{ color: t.muted }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: 'rgba(139,92,246,0.10)', color: 'var(--violet)' }}>{i + 1}</span>
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
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.heading }}>
                Check your inbox
              </h1>
              <p className="text-sm mb-6" style={{ color: t.muted }}>
                A secure reset link is on its way to <strong style={{ color: t.heading }}>{forgotEmail}</strong>.
                Open it to verify it's you, then set your new password here. The link expires in about an hour.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => { setView('login'); clearMessages(); }}
                  className="w-full h-11 rounded-[13px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #2563EB, var(--violet))' }}
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="w-full h-11 rounded-[13px] text-[13.5px] font-semibold"
                  style={{ backgroundColor: t.inputBg, color: t.muted, border: `1px solid ${t.cardBorder}` }}
                >
                  Didn't get it? Send again
                </button>
              </div>
            </>
          )}

          {/* ═══ RESET — set the new password (arrived via emailed link) ═══ */}
          {view === 'reset' && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.heading }}>
                Set a new password
              </h1>
              <p className="text-sm mb-7" style={{ color: t.sub }}>
                Verified — you're changing the password for <strong style={{ color: t.heading }}>{resetEmail}</strong>.
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
                  tokens={t}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-colors hover:bg-black/5"
                      style={{ color: t.icon }}
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
                  tokens={t}
                />
                <button
                  type="submit"
                  disabled={loading || newPassword.length === 0 || confirmNew.length === 0}
                  className="w-full h-11 rounded-[13px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2 transition-transform disabled:opacity-60 disabled:pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #2563EB, var(--violet))' }}
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
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.heading }}>
                Password changed
              </h1>
              <p className="text-sm mb-6" style={{ color: t.muted }}>
                Your password has been updated. Sign in with the new password to continue.
              </p>
              <button
                type="button"
                onClick={() => { setView('login'); clearMessages(); navigate('/login', { replace: true }); }}
                className="w-full h-11 rounded-[13px] text-[13.5px] font-bold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #2563EB, var(--violet))' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>
                Back to sign in
              </button>
            </>
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

function BackToLogin({ onClick, color }: { onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-semibold mb-5 hover:underline"
      style={{ color }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
      Back to sign in
    </button>
  );
}

interface Tokens { label: string; inputBg: string; inputBorder: string; heading: string; icon: string; }

function InputField({
  label, icon, trailing, tokens, ...input
}: { label: string; icon: string; trailing?: ReactNode; tokens: Tokens } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5" style={{ color: tokens.label }}>{label}</span>
      <div
        className="flex items-center gap-2.5 h-11 pl-3.5 pr-1.5 rounded-xl transition-all duration-150"
        style={{ backgroundColor: tokens.inputBg, border: `1px solid ${tokens.inputBorder}` }}
        onFocusCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'rgba(139,92,246,0.45)';
          el.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.14)';
        }}
        onBlurCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = tokens.inputBorder;
          el.style.boxShadow = 'none';
        }}
      >
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: tokens.icon }}>{icon}</span>
        <input
          {...input}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: tokens.heading, minWidth: 0 }}
        />
        {trailing}
      </div>
    </label>
  );
}
