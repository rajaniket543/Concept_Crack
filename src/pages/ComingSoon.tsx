import { Link, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { pathFor } from '../lib/pages';
import { useTheme } from '../lib/theme';

// Fixed particle field so it doesn't reshuffle on re-render (e.g. theme toggle).
const PARTICLES = [
  { left: '6%',  size: 5, duration: 13, delay: 0,    drift: '18px'  },
  { left: '14%', size: 3, duration: 17, delay: 2.4,  drift: '-24px' },
  { left: '23%', size: 6, duration: 11, delay: 5.1,  drift: '10px'  },
  { left: '32%', size: 4, duration: 15, delay: 1.2,  drift: '-14px' },
  { left: '41%', size: 3, duration: 19, delay: 6.8,  drift: '22px'  },
  { left: '52%', size: 5, duration: 12, delay: 3.6,  drift: '-18px' },
  { left: '61%', size: 4, duration: 16, delay: 0.8,  drift: '16px'  },
  { left: '69%', size: 6, duration: 14, delay: 8.2,  drift: '-10px' },
  { left: '77%', size: 3, duration: 18, delay: 4.4,  drift: '20px'  },
  { left: '85%', size: 5, duration: 13, delay: 2.0,  drift: '-22px' },
  { left: '92%', size: 4, duration: 20, delay: 7.0,  drift: '12px'  },
  { left: '48%', size: 3, duration: 15, delay: 10.5, drift: '-16px' },
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
                width: p.size,
                height: p.size,
                backgroundColor: i % 3 === 0 ? '#5B4FE8' : i % 3 === 1 ? '#8B5CF6' : '#06B6D4',
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                ['--cc-drift' as string]: p.drift,
              }}
            />
          ))}
        </div>

        {/* Soft blobs */}
        <div className="absolute top-16 left-1/5 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} aria-hidden="true" />
        <div className="absolute bottom-10 right-1/5 w-72 h-72 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} aria-hidden="true" />

        <div className="relative w-full max-w-3xl mx-auto px-6 py-20 text-center">
          {plan && (
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
              style={{ background: 'rgba(91,79,232,0.12)', border: '1px solid rgba(91,79,232,0.25)', color: '#5B4FE8' }}
            >
              <span className="material-symbols-outlined filled" style={{ fontSize: '14px' }}>bolt</span>
              You selected the {plan} Plan
            </div>
          )}

          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(91,79,232,0.18), rgba(139,92,246,0.14))',
              border: '1px solid rgba(91,79,232,0.30)',
              boxShadow: '0 12px 40px rgba(91,79,232,0.25)',
              animation: 'ccFloatA 6s ease-in-out infinite',
            }}
          >
            <span className="material-symbols-outlined filled" style={{ fontSize: '38px', color: '#8B5CF6' }}>rocket_launch</span>
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
