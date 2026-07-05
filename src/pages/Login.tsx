import { FormEvent, KeyboardEvent, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as authLogin, forgotPassword, sendPhoneOtp, verifyPhoneOtp, type ConfirmationResult } from '../lib/auth';
import { getStudentStream } from '../lib/stream';
import { seedDemoAccounts, markDemoSeeded, seedConceptCrackAccounts, type SeedResult, type CCAccountResult } from '../lib/seed-demo';
import { LoginRole, pathFor } from '../lib/pages';
import Spinner from '../components/Spinner';
import { useTheme } from '../lib/theme';

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
  const [ccLoading,   setCCLoading]   = useState(false);
  const [ccResults,   setCCResults]   = useState<CCAccountResult[] | null>(null);
  const [ccProgress,  setCCProgress]  = useState({ done: 0, total: 53, current: '' });
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const trimmedId = identifier.trim();
  const emailLooksValid = method !== 'email' || EMAIL_REGEX.test(trimmedId);
  const isPhoneMethod = method === 'mobile' || method === 'otp';
  const canSubmit =
    !loading &&
    trimmedId.length > 0 &&
    (isPhoneMethod ? (!phoneConfirmation || otpCode.trim().length > 0) : emailLooksValid && password.length > 0);

  function detectCapsLock(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  }

  useEffect(() => {
    const preset = roleDefs.find(r => r.key === role) ?? roleDefs[0];
    setIdentifier(isPhoneMethod ? '' : preset.identifier);
    setPassword(preset.password);
    setOtpCode('');
    setChallengeId(null);
    setPhoneConfirmation(null);
    setStatusMessage(null);
    setErrorMessage(null);
  }, [role]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (isPhoneMethod) {
        if (!phoneConfirmation) {
          const confirmation = await sendPhoneOtp(identifier, recaptchaRef.current!);
          setPhoneConfirmation(confirmation);
          setStatusMessage(`OTP sent to ${identifier}. Enter the 6-digit code below.`);
          return;
        }
        const session = await verifyPhoneOtp(phoneConfirmation, otpCode, role);
        if (session.user.role === 'student' && !getStudentStream()) {
          navigate('/student/select-stream', { replace: true });
        } else {
          navigate(session.redirectTo);
        }
        return;
      }
      const session = await authLogin({ identifier, password, role, method });
      if (session.user.role === 'student' && !getStudentStream()) {
        navigate('/student/select-stream', { replace: true });
      } else {
        navigate(session.redirectTo);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed. Please try again.');
      if (isPhoneMethod) setPhoneConfirmation(null);
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

  async function handleSetupAllAccounts() {
    setCCLoading(true);
    setCCResults(null);
    setCCProgress({ done: 0, total: 53, current: '' });
    setErrorMessage(null);
    try {
      const results = await seedConceptCrackAccounts((done, total, current) => {
        setCCProgress({ done, total, current });
      });
      setCCResults(results);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setCCLoading(false);
    }
  }

  const submitLabel = isPhoneMethod ? (phoneConfirmation ? 'Verify OTP' : 'Send OTP') : 'Sign in';

  return (
    <>
    {/* Invisible reCAPTCHA container — must be in DOM but outside the layout grid */}
    <div ref={recaptchaRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />
    <div
      className="min-h-screen grid lg:grid-cols-2"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: isDark ? '#0F0E17' : '#FFFFFF', color: isDark ? '#F9FAFB' : '#111827' }}
    >
      {/* ── Left panel ── */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 xl:p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0E17 0%, #1A1929 100%)' }}
      >
        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-20 -left-10 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} />
          <div className="absolute bottom-20 right-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
          <div className="absolute top-1/2 right-10 w-32 h-32 rounded-full blur-2xl opacity-15" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} />
        </div>

        {/* Full-bleed hero photo covering the left half.
            Save your image as  public/login-hero.jpg  (falls back to the
            gradient below if the file is not present). */}
        <img
          src="/login-hero.jpg"
          alt=""
          aria-hidden="true"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
          style={{ objectPosition: 'center' }}
        />
        {/* Dark overlay so the headline, features and testimonial stay readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'linear-gradient(160deg, rgba(15,14,23,0.90) 0%, rgba(26,25,41,0.78) 55%, rgba(15,14,23,0.92) 100%)' }}
        />

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
      <main className="relative flex items-center justify-center p-6 lg:p-10 xl:p-14" style={{ backgroundColor: isDark ? '#0F0E17' : '#FAFAFA' }}>
        <Link
          to={pathFor('landing')}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
          style={{ backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6', color: isDark ? '#9CA3AF' : '#6B7280', border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}` }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>info</span>
          About Us
        </Link>
        <div
          className="w-full max-w-[560px] rounded-[32px] p-6 sm:p-8 lg:p-10"
          style={{
            backgroundColor: isDark ? 'rgba(30,29,46,0.72)' : 'rgba(255,255,255,0.86)',
            border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
            boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.35)' : '0 24px 80px rgba(17,24,39,0.08)',
            backdropFilter: 'blur(18px)',
          }}
        >
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
                  onClick={() => {
                    setMethod(m.key);
                    setChallengeId(null);
                    setOtpCode('');
                    setPhoneConfirmation(null);
                    setStatusMessage(null);
                    setErrorMessage(null);
                    const isPhone = m.key === 'mobile' || m.key === 'otp';
                    const preset = roleDefs.find(r => r.key === role) ?? roleDefs[0];
                    setIdentifier(isPhone ? '' : preset.identifier);
                  }}
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
                <InputField label="Mobile number" type="tel" value={identifier} onChange={e => setIdentifier(e.target.value)} icon="smartphone" placeholder="+91 9876543210" isDark={isDark} autoComplete="tel" disabled={!!phoneConfirmation} />
                {phoneConfirmation && (
                  <InputField label="Enter OTP" type="text" inputMode="numeric" value={otpCode} onChange={e => setOtpCode(e.target.value)} icon="pin" placeholder="6-digit OTP" isDark={isDark} autoComplete="one-time-code" />
                )}
              </>
            )}

            {method === 'otp' && (
              <>
                <InputField label="Mobile number" type="tel" value={identifier} onChange={e => setIdentifier(e.target.value)} icon="smartphone" placeholder="+91 9876543210" isDark={isDark} autoComplete="tel" disabled={!!phoneConfirmation} />
                {phoneConfirmation && (
                  <InputField label="Enter OTP" type="text" inputMode="numeric" value={otpCode} onChange={e => setOtpCode(e.target.value)} icon="pin" placeholder="6-digit OTP" isDark={isDark} autoComplete="one-time-code" />
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
                <Spinner size={16} />
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {method === 'otp' && !challengeId ? 'send' : 'login'}
                </span>
              )}
              {loading ? 'Signing in...' : submitLabel}
            </button>
          </form>

          {/* First-time setup */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: isDark ? '#2D2B42' : '#E5E7EB' }}>
            <p className="text-xs text-center mb-3" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>
              First time? Set up accounts in Firebase:
            </p>

            {/* Full 53-account seed */}
            <button
              type="button"
              onClick={handleSetupAllAccounts}
              disabled={ccLoading || seedLoading}
              className="w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mb-2"
              style={{
                background: ccLoading ? undefined : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.12))',
                border: `1px solid ${isDark ? 'rgba(16,185,129,0.30)' : 'rgba(16,185,129,0.40)'}`,
                color: '#10B981',
              }}
            >
              {ccLoading
                ? <><Spinner size={14} /> Creating… ({ccProgress.done}/{ccProgress.total})</>
                : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group_add</span> Setup All Accounts (53 accounts)</>
              }
            </button>

            {/* Demo 4-account seed */}
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seedLoading || ccLoading}
              className="w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none"
              style={{
                backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6',
                border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
                color: isDark ? '#9CA3AF' : '#6B7280',
              }}
            >
              {seedLoading
                ? <><Spinner size={14} /> Setting up…</>
                : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>database</span> Setup Demo Accounts (4 accounts)</>
              }
            </button>

            {/* CC Seed results */}
            {ccResults && (
              <div className="mt-3">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {ccResults.map(r => (
                    <div
                      key={r.email}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs"
                      style={{
                        backgroundColor: r.status === 'error' ? 'rgba(239,68,68,0.08)' : r.status === 'created' ? 'rgba(16,185,129,0.06)' : isDark ? '#1E1D2E' : '#F9FAFB',
                        border: `1px solid ${r.status === 'error' ? 'rgba(239,68,68,0.2)' : r.status === 'created' ? 'rgba(16,185,129,0.15)' : isDark ? '#2D2B42' : '#E5E7EB'}`,
                      }}
                    >
                      <span className="truncate max-w-[200px]" style={{ color: isDark ? '#D1D5DB' : '#374151' }}>{r.email}</span>
                      <span className="font-semibold shrink-0 ml-2" style={{ color: r.status === 'error' ? '#EF4444' : r.status === 'created' ? '#10B981' : '#6B7280' }}>
                        {r.status === 'created' ? '✓' : r.status === 'exists' ? '•' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs pt-2" style={{ color: '#10B981' }}>
                  {ccResults.filter(r => r.status === 'created').length} created · {ccResults.filter(r => r.status === 'exists').length} already existed · Sign in to continue
                </p>
              </div>
            )}

            {/* Demo seed results */}
            {seedResults && (
              <div className="mt-3 space-y-1.5">
                {seedResults.map(r => (
                  <div
                    key={r.email}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{
                      backgroundColor: r.status === 'error' ? 'rgba(239,68,68,0.08)' : r.status === 'created' ? 'rgba(16,185,129,0.08)' : isDark ? '#1E1D2E' : '#F9FAFB',
                      border: `1px solid ${r.status === 'error' ? 'rgba(239,68,68,0.2)' : r.status === 'created' ? 'rgba(16,185,129,0.2)' : isDark ? '#2D2B42' : '#E5E7EB'}`,
                    }}
                  >
                    <span style={{ color: isDark ? '#D1D5DB' : '#374151' }}>{r.email}</span>
                    <span className="font-semibold" style={{ color: r.status === 'error' ? '#EF4444' : r.status === 'created' ? '#10B981' : '#6B7280' }}>
                      {r.status === 'created' ? '✓ Created' : r.status === 'exists' ? '• Exists' : `✗ ${r.error}`}
                    </span>
                  </div>
                ))}
                <p className="text-center text-xs pt-1" style={{ color: '#10B981' }}>
                  Done! Sign in with the pre-filled credentials above.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-center mt-4" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold hover:underline" style={{ color: '#5B4FE8' }}>Contact admin</a>
          </p>
        </div>
      </main>
    </div>
    </>
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
