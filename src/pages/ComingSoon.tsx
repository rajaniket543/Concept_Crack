import { Link, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { pathFor } from '../lib/pages';
import { useTheme } from '../lib/theme';

// Fixed particle field so it doesn't reshuffle on re-render (e.g. theme toggle).
// Static decorative dots. `top` is explicit because these no longer animate —
// the old rising animation was what positioned them and faded them in.
const PARTICLES = [
  { left: '6%',  top: '18%', size: 5, opacity: 0.55 },
  { left: '14%', top: '62%', size: 3, opacity: 0.40 },
  { left: '23%', top: '34%', size: 6, opacity: 0.50 },
  { left: '32%', top: '78%', size: 4, opacity: 0.35 },
  { left: '41%', top: '12%', size: 3, opacity: 0.45 },
  { left: '52%', top: '84%', size: 5, opacity: 0.40 },
  { left: '61%', top: '26%', size: 4, opacity: 0.50 },
  { left: '69%', top: '68%', size: 6, opacity: 0.35 },
  { left: '77%', top: '40%', size: 3, opacity: 0.45 },
  { left: '85%', top: '74%', size: 5, opacity: 0.40 },
  { left: '92%', top: '22%', size: 4, opacity: 0.50 },
  { left: '48%', top: '52%', size: 3, opacity: 0.30 },
];

export default function ComingSoon() {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const plan = (location.state as { plan?: string } | null)?.plan;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: isDark ? '#0F0E17' : '#FFFFFF', color: isDark ? '#F9FAFB' : '#111827' }}
    >
      {/* ── Nav (branding only — no login/signup on this page) ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-10"
        style={{
          height: '64px',
          backgroundColor: isDark ? 'rgba(15,14,23,0.90)' : 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
        }}
      >
        <Link to={pathFor('landing')} className="flex items-center gap-2.5">
          <Logo size="sm" tone="theme" />
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: isDark ? '#9CA3AF' : '#6B7280', backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6' }}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </header>

      {/* ── Hero ── */}
      <main
        className="relative flex-1 overflow-hidden flex items-center"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(91,79,232,0.25) 0%, transparent 70%), #0F0E17'
            : 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(91,79,232,0.10) 0%, transparent 70%), #FFFFFF',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {/* Rotating aurora glow */}
        <div className="absolute pointer-events-none cc-hero-aurora" aria-hidden="true" />

        {/* Animated grid */}
        <div className="absolute inset-0 pointer-events-none cc-hero-grid" aria-hidden="true" />

        {/* Rising particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="cc-particle"
              style={{
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                backgroundColor: i % 3 === 0 ? '#5B4FE8' : i % 3 === 1 ? '#8B5CF6' : '#06B6D4',
              }}
            />
          ))}
        </div>

        {/* Soft blobs */}
        <div className="absolute top-16 left-1/5 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} aria-hidden="true" />
        <div className="absolute bottom-10 right-1/5 w-72 h-72 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} aria-hidden="true" />

        <div className="relative w-full max-w-3xl mx-auto px-6 py-20 text-center">
          {/* Each of these is wrapped in its own flex row. Left as bare
              inline-flex siblings they share a line, so arriving with a plan
              selected pushed the badge and the rocket onto the same row. */}
          {plan && (
            <div className="flex justify-center mb-6">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(91,79,232,0.12)', border: '1px solid rgba(91,79,232,0.25)', color: '#5B4FE8' }}
              >
                <span className="material-symbols-outlined filled" style={{ fontSize: '14px' }}>bolt</span>
                You selected the {plan} Plan
              </div>
            </div>
          )}

          <div className="flex justify-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(91,79,232,0.18), rgba(139,92,246,0.14))',
                border: '1px solid rgba(91,79,232,0.30)',
                boxShadow: '0 12px 40px rgba(91,79,232,0.25)',
              }}
            >
              <span className="material-symbols-outlined filled" style={{ fontSize: '38px', color: '#8B5CF6' }}>rocket_launch</span>
            </div>
          </div>

          <h1
            className="font-headline font-extrabold leading-tight tracking-tight mb-5"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(2.5rem, 7vw, 4rem)', letterSpacing: '-0.04em' }}
          >
            <span style={{ background: 'linear-gradient(135deg, #5B4FE8, #8B5CF6, #06B6D4)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'ccShimmer 6s linear infinite' }}>
              Coming Soon
            </span>
          </h1>

          <p className="text-xl font-semibold mb-4" style={{ color: isDark ? '#E5E7EB' : '#374151' }}>
            We&rsquo;re working on something exciting.
          </p>

          <p className="text-base leading-relaxed max-w-xl mx-auto mb-10" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            Our subscription plans will be available soon. Get ready for a smarter and more personalized JEE &amp; NEET preparation experience.
          </p>

          <Link
            to={pathFor('landing')}
            className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 6px 20px rgba(91,79,232,0.40)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
