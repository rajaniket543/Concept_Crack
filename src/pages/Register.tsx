import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register as authRegister } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { pathFor } from '../lib/pages';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const canSubmit =
    !loading &&
    name.trim().length >= 2 &&
    emailValid &&
    mobile.trim().length >= 7 &&
    password.length >= 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await authRegister({ name, email, mobile, password });
      navigate(session.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  const textColor = isDark ? '#F9FAFB' : '#111827';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: isDark ? '#0F0E17' : '#FAFAFA', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="w-full max-w-[440px]">
        <Link to={pathFor('landing')} className="inline-flex items-center gap-2.5 mb-7">
          <img src="/logo.png" alt="Concept Crack" className="w-9 h-9 rounded-xl object-cover" />
          <span className="font-bold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: textColor }}>
            Concept Crack
          </span>
        </Link>

        <div className="card">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: textColor }}>
            Create your account
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Start your personalized exam prep in minutes.
          </p>

          {error && (
            <div className="alert alert-error mb-4" role="alert">
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18 }}>error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="input-label" htmlFor="reg-name">Full name</label>
              <input id="reg-name" className="input-field" type="text" autoComplete="name" placeholder="Arjun Sharma"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="input-label" htmlFor="reg-email">Email address</label>
              <input id="reg-email" className="input-field" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={email.length > 0 && !emailValid} />
              {email.length > 0 && !emailValid && (
                <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>Enter a valid email address.</p>
              )}
            </div>
            <div>
              <label className="input-label" htmlFor="reg-mobile">Mobile number</label>
              <input id="reg-mobile" className="input-field" type="tel" autoComplete="tel" placeholder="+91 98765 43210"
                value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <div>
              <label className="input-label" htmlFor="reg-password">Password</label>
              <div className="relative">
                <input id="reg-password" className="input-field" type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="At least 8 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ color: 'var(--text-faint)' }} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button type="submit" disabled={!canSubmit}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}>
              {loading ? (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
              )}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-center mt-6" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to={pathFor('login')} className="font-semibold hover:underline" style={{ color: '#5B4FE8' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
