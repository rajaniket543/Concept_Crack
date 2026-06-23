import { FormEvent, KeyboardEvent, useEffect, useState, type InputHTMLAttributes } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as authLogin, requestOtp, verifyOtp, forgotPassword } from '../lib/auth';
import { seedDemoAccounts, markDemoSeeded, type SeedResult } from '../lib/seed-demo';
import { LoginRole, pathFor } from '../lib/pages';
import { useTheme } from '../lib/theme';
import { useToast } from '../components/Toast';

const SUPPORT_EMAIL = 'support@conceptcrack.app';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Method = 'email' | 'mobile' | 'otp';

const roleDefs: { key: LoginRole; label: string; icon: string; identifier: string; password: string }[] = [
  { key: 'student', label: 'Student',  icon: 'school',                identifier: 'student@prepmind.ai',  password: 'Student@123' },
  { key: 'parent',  label: 'Parent',   icon: 'family_restroom',       identifier: 'parent@prepmind.ai',   password: 'Parent@123' },
  { key: 'faculty', label: 'Faculty',  icon: 'co_present',            identifier: 'faculty@prepmind.ai',  password: 'Faculty@123' },
  { key: 'admin',   label: 'Admin',    icon: 'admin_panel_settings',  identifier: 'admin@prepmind.ai',    password: 'Admin@123' },
];

const leftPanelFeatures = [
  { icon: 'psychology', label: 'AI Adaptive Learning', desc: 'Personalized to your strengths & gaps' },
  { icon: 'analytics',  label: 'Real-time Analytics',  desc: 'Deep insights into your performance' },
  { icon: 'quiz',       label: 'Smart Mock Tests',      desc: 'Full-length tests with anti-cheat' },
];

export default function Login() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const toast = useToast();
  const [role, setRole] = useState<LoginRole>('student');
  const [method, setMethod] = useState<Method>('email');
  const [identifier, setIdentifier] = useState(roleDefs[0].identifier);
  const [password, setPassword] = useState(roleDefs[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[] | null>(null);

  const trimmedId = identifier.trim();
  const emailLooksValid = method !== 'email' || EMAIL_REGEX.test(trimmedId);
  const canSubmit =
    !loading &&
    trimmedId.length > 0 &&
    emailLooksValid &&
    (method === 'otp' ? (!challengeId || otpCode.trim().length > 0) : password.length > 0);

  function detectCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  }

  useEffect(() => {
    const preset = roleDefs.find(r => r.key === role) ?? roleDefs[0];
    setIdentifier(preset.identifier);
    setPassword(preset.password);
    setOtpCode('');
    setChallengeId(null);
    setStatusMessage(null);
    setErrorMessage(null);
  }, [role]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (method === 'otp') {
        if (!challengeId) {
          const challenge = await requestOtp({ identifier, role });
          setChallengeId(challenge.challengeId);
          setStatusMessage(challenge.message);
          return;
        }
        const session = await verifyOtp({ challengeId, code: otpCode });
        navigate(session.redirectTo);
        return;
      }
      const session = await authLogin({ identifier, password, role, method });
      navigate(session.redirectTo);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const value = window.prompt('Enter your email address:');
    if (!value) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await forgotPassword(value);
      setStatusMessage(`Password reset email sent to ${value}. Check your inbox.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSeedDemo() {
    setSeedLoading(true);
    setSeedResults(null);
    setErrorMessage(null);
    try {
      const results = await seedDemoAccounts();
      await markDemoSeeded();
      setSeedResults(results);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Seeding failed.');
    } finally {
      setSeedLoading(false);
    }
  }

  const submitLabel = method === 'otp' ? (challengeId ? 'Verify OTP' : 'Send OTP') : 'Sign in';

  return (
    <div
      className="min-h-screen grid lg:grid-cols-[40%_60%]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: isDark ? '#0F0E17' : '#FFFFFF', color: isDark ? '#F9FAFB' : '#111827' }}
    >
      {/* ── Left panel ── */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0E17 0%, #1A1929 100%)' }}
      >
        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-20 -left-10 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} />
          <div className="absolute bottom-20 right-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
          <div className="absolute top-1/2 right-10 w-32 h-32 rounded-full blur-2xl opacity-15" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} />
        </div>

        <div className="relative">
          <Link to={pathFor('landing')} className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Concept Crack" className="w-9 h-9 rounded-xl object-cover" />
            <span className="font-bold text-white text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Concept Crack</span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight text-white mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>
            Your path to the<br />top rank starts here
          </h2>
          <p className="text-sm mb-10" style={{ color: '#9CA3AF' }}>
            Join 2M+ students using AI to crack JEE, NEET, UPSC, and CAT.
          </p>
          <div className="space-y-4">
            {leftPanelFeatures.map(feat => (
              <div key={feat.label} className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(91,79,232,0.20)', border: '1px solid rgba(91,79,232,0.30)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#818CF8' }}>{feat.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{feat.label}</div>
                  <div className="text-xs" style={{ color: '#6B7280' }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial card */}
        <div
          className="relative rounded-xl p-5"
          style={{ backgroundColor: 'rgba(30,29,46,0.80)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex mb-2.5 gap-0.5">
            {[1,2,3,4,5].map(i => <span key={i} className="material-symbols-outlined filled text-amber-400" style={{ fontSize: '14px' }}>star</span>)}
          </div>
          <p className="text-sm mb-3 italic" style={{ color: '#D1D5DB', lineHeight: 1.6 }}>
            "Concept Crack's AI identified my weak areas in Physics in just 3 days. I improved my rank from 8,000 to 247."
          </p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>PS</div>
            <div>
              <div className="text-sm font-semibold text-white">Priya Sharma</div>
              <div className="text-xs" style={{ color: '#6B7280' }}>JEE Advanced — AIR 247</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="flex items-center justify-center p-6 lg:p-14" style={{ backgroundColor: isDark ? '#0F0E17' : '#FAFAFA' }}>
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link to={pathFor('landing')} className="inline-flex items-center gap-2">
              <img src="/logo.png" alt="Concept Crack" className="w-8 h-8 rounded-xl object-cover" />
              <span className="font-bold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: isDark ? '#F9FAFB' : '#111827' }}>Concept Crack</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: isDark ? '#F9FAFB' : '#111827' }}>
            Welcome back
          </h1>
          <p className="text-sm mb-7" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
            Sign in to continue your preparation
          </p>

          {/* Role selector */}
          <div
            className="grid grid-cols-4 gap-1.5 p-1.5 rounded-xl mb-6"
            style={{ backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6' }}
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
                  onClick={() => setRole(r.key)}
                  className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={active
                    ? { backgroundColor: '#5B4FE8', color: '#fff', boxShadow: '0 2px 8px rgba(91,79,232,0.30)' }
                    : { color: isDark ? '#9CA3AF' : '#6B7280', backgroundColor: 'transparent' }
                  }
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{r.icon}</span>
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Method tabs */}
          <div className="flex items-center gap-0 mb-6 border-b" style={{ borderColor: isDark ? '#2D2B42' : '#E5E7EB' }} role="tablist" aria-label="Sign-in method">
            {([{ key: 'email', label: 'Email' }, { key: 'mobile', label: 'Mobile' }, { key: 'otp', label: 'OTP Login' }] as { key: Method; label: string }[]).map(m => {
              const active = method === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setMethod(m.key); setChallengeId(null); setOtpCode(''); setStatusMessage(null); setErrorMessage(null); }}
                  className="h-10 px-4 text-sm font-semibold -mb-px border-b-2 transition-all duration-150"
                  style={active
                    ? { color: '#5B4FE8', borderBottomColor: '#5B4FE8' }
                    : { color: isDark ? '#6B7280' : '#9CA3AF', borderBottomColor: 'transparent' }
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Status / Error messages */}
          {statusMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }}>check_circle</span>
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg mb-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }}>error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {method === 'email' && (
              <>
                <div>
                  <InputField
                    label="Email address"
                    type="email"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    icon="mail"
                    placeholder="you@example.com"
                    isDark={isDark}
                    autoComplete="email"
                    aria-invalid={!emailLooksValid}
                  />
                  {!emailLooksValid && trimmedId.length > 0 && (
                    <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>Enter a valid email address.</p>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <InputField
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyUp={detectCapsLock}
                      onKeyDown={detectCapsLock}
                      icon="lock"
                      placeholder="Enter your password"
                      isDark={isDark}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 bottom-2.5 w-9 h-9 flex items-center justify-center rounded transition-colors"
                      style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                  {capsLock && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>keyboard_capslock</span>
                      Caps Lock is on
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
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
                    onClick={handleForgotPassword}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: '#5B4FE8' }}
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {method === 'mobile' && (
              <>
                <InputField label="Mobile number" type="tel" value={identifier} onChange={e => setIdentifier(e.target.value)} icon="smartphone" placeholder="+91 9876543210" isDark={isDark} autoComplete="tel" />
                <div className="relative">
                  <InputField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    icon="lock"
                    placeholder="Enter your password"
                    isDark={isDark}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 bottom-2.5 w-9 h-9 flex items-center justify-center rounded" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }} tabIndex={-1}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </>
            )}

            {method === 'otp' && (
              <>
                <InputField label="Email or mobile" type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} icon="vpn_key" placeholder="Email or mobile number" isDark={isDark} />
                {challengeId && (
                  <InputField label="Enter OTP" type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)} icon="pin" placeholder="6-digit OTP" isDark={isDark} autoComplete="one-time-code" />
                )}
              </>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {method === 'otp' && !challengeId ? 'send' : 'login'}
                </span>
              )}
              {loading ? 'Signing in...' : submitLabel}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ backgroundColor: isDark ? '#2D2B42' : '#E5E7EB' }} />
            <span className="text-xs" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>or continue with</span>
            <div className="flex-1 h-px" style={{ backgroundColor: isDark ? '#2D2B42' : '#E5E7EB' }} />
          </div>

          <button
            type="button"
            onClick={() => toast('Google sign-in is coming soon.', 'info')}
            className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all hover:-translate-y-px"
            style={{
              backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF',
              border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
              color: isDark ? '#E5E7EB' : '#374151',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* First-time setup */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: isDark ? '#2D2B42' : '#E5E7EB' }}>
            <p className="text-xs text-center mb-3" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>
              First time? Create the 4 demo accounts in Firebase:
            </p>
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seedLoading}
              className="w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none"
              style={{
                backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6',
                border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
                color: isDark ? '#9CA3AF' : '#6B7280',
              }}
            >
              {seedLoading
                ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span> Setting up…</>
                : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>database</span> Setup Demo Accounts</>
              }
            </button>

            {/* Seed results */}
            {seedResults && (
              <div className="mt-3 space-y-1.5">
                {seedResults.map(r => (
                  <div
                    key={r.email}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{
                      backgroundColor: r.status === 'error'
                        ? 'rgba(239,68,68,0.08)'
                        : r.status === 'created'
                          ? 'rgba(16,185,129,0.08)'
                          : isDark ? '#1E1D2E' : '#F9FAFB',
                      border: `1px solid ${r.status === 'error' ? 'rgba(239,68,68,0.2)' : r.status === 'created' ? 'rgba(16,185,129,0.2)' : isDark ? '#2D2B42' : '#E5E7EB'}`,
                    }}
                  >
                    <span style={{ color: isDark ? '#D1D5DB' : '#374151' }}>{r.email}</span>
                    <span
                      className="font-semibold"
                      style={{ color: r.status === 'error' ? '#EF4444' : r.status === 'created' ? '#10B981' : '#6B7280' }}
                    >
                      {r.status === 'created' ? '✓ Created' : r.status === 'exists' ? '• Already exists' : `✗ ${r.error}`}
                    </span>
                  </div>
                ))}
                <p className="text-center text-xs pt-1" style={{ color: '#10B981' }}>
                  All done! You can now sign in with the pre-filled credentials.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-center mt-4" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>
            <Link to={pathFor('landing')} className="font-semibold hover:underline" style={{ color: '#5B4FE8' }}>Learn more</Link>
            {' · '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold hover:underline" style={{ color: '#5B4FE8' }}>Contact admin</a>
          </p>
        </div>
      </main>
    </div>
  );
}

function InputField({
  label, icon, isDark, ...input
}: { label: string; icon: string; isDark: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5" style={{ color: isDark ? '#D1D5DB' : '#374151' }}>{label}</span>
      <div
        className="flex items-center gap-2.5 h-11 px-3.5 rounded-xl transition-all duration-150"
        style={{
          backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF',
          border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
        }}
        onFocusCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = '#5B4FE8';
          el.style.boxShadow = '0 0 0 3px rgba(91,79,232,0.12)';
        }}
        onBlurCapture={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = isDark ? '#2D2B42' : '#E5E7EB';
          el.style.boxShadow = 'none';
        }}
      >
        <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: isDark ? '#4B5563' : '#9CA3AF' }}>{icon}</span>
        <input
          {...input}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: isDark ? '#F9FAFB' : '#111827', minWidth: 0 }}
        />
      </div>
    </label>
  );
}
