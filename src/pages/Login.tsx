import { FormEvent, useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as authLogin, requestOtp, verifyOtp } from '../lib/auth';
import { LoginRole, pathFor } from '../lib/pages';

type Method = 'email' | 'mobile' | 'otp';

const roleDefs: { key: LoginRole; label: string; icon: string; identifier: string; password: string }[] = [
  { key: 'student', label: 'Student', icon: 'school', identifier: 'student@prepmind.ai', password: 'Student@123' },
  { key: 'parent', label: 'Parent', icon: 'family_restroom', identifier: 'parent@prepmind.ai', password: 'Parent@123' },
  { key: 'faculty', label: 'Faculty', icon: 'co_present', identifier: 'faculty@prepmind.ai', password: 'Faculty@123' },
  { key: 'admin', label: 'Admin', icon: 'admin_panel_settings', identifier: 'admin@prepmind.ai', password: 'Admin@123' },
];

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<LoginRole>('student');
  const [method, setMethod] = useState<Method>('email');
  const [identifier, setIdentifier] = useState(roleDefs[0].identifier);
  const [password, setPassword] = useState(roleDefs[0].password);
  const [otpCode, setOtpCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const preset = roleDefs.find((item) => item.key === role) ?? roleDefs[0];
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
          setStatusMessage(`${challenge.message} Dev OTP: ${challenge.devCode}`);
          return;
        }

        const session = await verifyOtp({ challengeId, code: otpCode });
        navigate(session.redirectTo);
        return;
      }

      const session = await authLogin({ identifier, password, role, method });
      navigate(session.redirectTo);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const value = window.prompt('Enter your email or mobile number to receive a reset token:');
    if (!value) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: value }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'Password reset failed.');
      }
      const data = payload.data as { resetToken: string; resetLink: string; message: string };
      setStatusMessage(`${data.message} Dev reset token: ${data.resetToken}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start reset flow.');
    } finally {
      setLoading(false);
    }
  }

  const submitLabel =
    method === 'otp' ? (challengeId ? 'Verify OTP' : 'Send OTP') : 'Sign in';

  return (
    <div className="min-h-screen bg-background text-on-surface grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-primary text-on-primary">
        <Link to={pathFor('landing')} className="flex items-center gap-2 font-extrabold text-lg">
          <span className="w-10 h-10 rounded-md bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container">psychology</span>
          </span>
          PrepMind AI
        </Link>
        <div>
          <h2 className="text-headline-lg">Welcome back.</h2>
          <p className="text-body-lg opacity-80 mt-3 max-w-md">
            Sign in to your personalized learning dashboard. AI-curated practice, predictive analytics, and exam-grade
            insights - all in one place.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-10 max-w-md">
            {[
              { v: '1.2M+', l: 'Questions solved' },
              { v: '420+', l: 'Institutes' },
              { v: '4.8/5', l: 'Avg rating' },
            ].map((s) => (
              <div key={s.l} className="bg-white/5 border border-white/10 rounded-md p-3">
                <div className="text-headline-lg-mobile">{s.v}</div>
                <div className="text-label-md uppercase tracking-widest opacity-70 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-label-md opacity-70">© 2026 PrepMind AI</div>
      </aside>

      <main className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link to={pathFor('landing')} className="inline-flex items-center gap-2 font-extrabold text-lg">
              <span className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary">psychology</span>
              </span>
              PrepMind AI
            </Link>
          </div>

          <h1 className="text-headline-lg text-on-surface">Sign in to PrepMind AI</h1>
          <p className="text-body-md text-on-surface-variant mt-2">Choose your role to continue.</p>

          <div role="tablist" className="grid grid-cols-4 gap-2 p-1 bg-surface-container rounded-md mt-8">
            {roleDefs.map((r) => {
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  id={`tab-${r.key}`}
                  aria-selected={active}
                  onClick={() => setRole(r.key)}
                  className={[
                    'role-tab h-10 px-2 rounded text-label-md font-semibold flex items-center justify-center gap-1.5',
                    active
                      ? 'role-tab-active bg-primary text-on-primary shadow-elev-1'
                      : 'text-on-surface-variant hover:text-on-surface',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined text-[18px]">{r.icon}</span>
                  {r.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-6 border-b border-outline-variant mt-8">
            {(
              [
                { key: 'email', label: 'Email' },
                { key: 'mobile', label: 'Mobile' },
                { key: 'otp', label: 'OTP' },
              ] as { key: Method; label: string }[]
            ).map((m) => {
              const active = method === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMethod(m.key);
                    setChallengeId(null);
                    setOtpCode('');
                    setStatusMessage(null);
                    setErrorMessage(null);
                  }}
                  className={[
                    'h-11 text-label-lg font-semibold border-b-2 -mb-px',
                    active
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface',
                  ].join(' ')}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {statusMessage && (
            <div className="mt-4 rounded-lg border border-tertiary-fixed-dim bg-tertiary-fixed/20 p-3 text-body-md text-on-surface">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mt-4 rounded-lg border border-error/20 bg-error-container/30 p-3 text-body-md text-error">
              {errorMessage}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {method === 'email' && (
              <>
                <Field label="Email" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} icon="mail" />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon="lock"
                />
                <div className="flex items-center justify-between text-label-md">
                  <label className="inline-flex items-center gap-2 text-on-surface-variant">
                    <input type="checkbox" className="rounded border-outline text-primary focus:ring-primary" defaultChecked />
                    Remember me
                  </label>
                  <button type="button" onClick={handleForgotPassword} className="text-secondary font-semibold hover:underline">
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {method === 'mobile' && (
              <>
                <Field
                  label="Mobile number"
                  type="tel"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  icon="smartphone"
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon="lock"
                />
              </>
            )}

            {method === 'otp' && (
              <>
                <Field
                  label="Email or mobile"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  icon="vpn_key"
                />
                {challengeId && (
                  <Field
                    label="Enter OTP"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    icon="pin"
                  />
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded font-semibold text-label-lg bg-primary text-on-primary hover:bg-primary-container inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">{method === 'otp' && !challengeId ? 'send' : 'login'}</span>
              {loading ? 'Working...' : submitLabel}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-label-md text-on-surface-variant">
            <div className="h-px flex-1 bg-outline-variant" />
            or
            <div className="h-px flex-1 bg-outline-variant" />
          </div>

          <button
            type="button"
            className="w-full h-12 rounded font-semibold text-label-lg border border-outline text-on-surface hover:bg-surface-container inline-flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            Continue with Google
          </button>

          <p className="text-label-md text-on-surface-variant mt-6 text-center">
            Demo creds are prefilled for quick testing.
            <br />
            New here?{' '}
            <Link to={pathFor('landing')} className="text-secondary font-semibold hover:underline">
              Learn more
            </Link>
            {' · '}
            <a href="#" className="text-secondary font-semibold hover:underline">
              Contact administrator
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  icon,
  ...input
}: { label: string; icon: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-label-md font-semibold text-on-surface">{label}</span>
      <span className="mt-1.5 flex items-center gap-2 h-12 px-3 border border-outline rounded bg-surface-container-lowest focus-within:border-primary">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{icon}</span>
        <input
          {...input}
          className="flex-1 bg-transparent outline-none text-body-lg text-on-surface placeholder:text-on-surface-variant"
        />
      </span>
    </label>
  );
}
