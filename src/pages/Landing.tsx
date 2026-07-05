import { Link } from 'react-router-dom';
import { useState } from 'react';
import { pathFor } from '../lib/pages';
import { features, stats, testimonials } from '../mocks';
import { useTheme } from '../lib/theme';

const faqItems = [
  { q: 'Which exams does Concept Crack cover?', a: 'Concept Crack currently supports JEE (Main + Advanced), NEET UG, UPSC Prelims, and CAT. More exams are added regularly.' },
  { q: 'How does the AI adaptive engine work?', a: 'Our AI analyzes every answer you give — time spent, accuracy pattern, error type — and builds a real-time model of your strengths and gaps to recommend exactly what to practice next.' },
  { q: 'Can I use Concept Crack on mobile?', a: 'Yes. The web app is fully responsive and works on all modern browsers. Dedicated iOS and Android apps are in development.' },
  { q: 'Is there a free trial for Pro?', a: 'Yes — all new accounts get a 14-day free Pro trial with no credit card required.' },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { toggleTheme, isDark } = useTheme();

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: isDark ? '#0F0E17' : '#FFFFFF', color: isDark ? '#F9FAFB' : '#111827' }}
    >
      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-10"
        style={{
          height: '64px',
          backgroundColor: isDark ? 'rgba(15,14,23,0.90)' : 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            to={pathFor('login')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6', color: isDark ? '#9CA3AF' : '#6B7280' }}
            title="Back to Login"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          </Link>
          <Link to={pathFor('landing')} className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Concept Crack" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-headline font-bold text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Concept Crack</span>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          <a href="#features" className="hover:text-[#5B4FE8] transition-colors">Features</a>
          <a href="#stats" className="hover:text-[#5B4FE8] transition-colors">Why Concept Crack</a>
          <a href="#faq" className="hover:text-[#5B4FE8] transition-colors">FAQ</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6', color: isDark ? '#9CA3AF' : '#6B7280' }}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <Link
            to={pathFor('login')}
            className="h-9 px-4 rounded-lg text-sm font-semibold flex items-center transition-colors"
            style={{ color: isDark ? '#E5E7EB' : '#374151', backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6' }}
          >
            Log in
          </Link>
          <Link
            to={pathFor('login')}
            className="h-9 px-4 rounded-lg text-sm font-semibold flex items-center text-white transition-all hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
          >
            Start Free Trial
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(91,79,232,0.25) 0%, transparent 70%), #0F0E17'
            : 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(91,79,232,0.10) 0%, transparent 70%), #FFFFFF',
          minHeight: '88vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Mesh bg */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} />
          <div className="absolute bottom-20 right-1/4 w-64 h-64 rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
          <div className="absolute top-1/2 right-10 w-48 h-48 rounded-full opacity-10 blur-2xl" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} />
        </div>

        <div className="relative w-full max-w-6xl mx-auto px-6 lg:px-10 py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-8" style={{ background: 'rgba(91,79,232,0.12)', border: '1px solid rgba(91,79,232,0.25)', color: '#5B4FE8' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: '14px' }}>auto_awesome</span>
            Powered by Generative AI
          </div>

          <h1
            className="font-headline font-extrabold leading-tight tracking-tight mb-6"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', letterSpacing: '-0.04em' }}
          >
            Crack Any Exam with
            <br />
            <span style={{ background: 'linear-gradient(135deg, #5B4FE8, #8B5CF6, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              AI-Powered Intelligence
            </span>
          </h1>

          <p
            className="text-lg leading-relaxed mb-10 max-w-2xl mx-auto"
            style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
          >
            Concept Crack adapts to your unique learning style, identifies knowledge gaps in real-time, and creates a personalized path to your dream rank. Used by 2M+ students across JEE, NEET, UPSC, and CAT.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={pathFor('login')}
              className="h-12 px-7 rounded-xl text-base font-semibold text-white flex items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 6px 20px rgba(91,79,232,0.40)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>rocket_launch</span>
              Start Preparing Free
            </Link>
            <Link
              to={pathFor('login')}
              className="h-12 px-7 rounded-xl text-base font-semibold flex items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6', border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`, color: isDark ? '#E5E7EB' : '#374151' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_circle</span>
              Watch Demo
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['A', 'R', 'P'].map((l, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
                    style={{ borderColor: isDark ? '#0F0E17' : '#fff', background: `hsl(${240 + i * 40}, 70%, 55%)` }}>
                    {l}
                  </div>
                ))}
              </div>
              <span>2M+ students</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1,2,3,4,5].map(i => <span key={i} className="material-symbols-outlined filled text-amber-400" style={{ fontSize: '16px' }}>star</span>)}
              <span>4.9/5 rating</span>
            </div>
            <span>JEE · NEET · UPSC · CAT</span>
          </div>
        </div>
      </section>

      {/* ── Stats Band ── */}
      <section
        id="stats"
        className="py-6 border-y"
        style={{ backgroundColor: isDark ? '#1E1D2E' : '#F9FAFB', borderColor: isDark ? '#2D2B42' : '#E5E7EB' }}
      >
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <div className="text-2xl font-headline font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#5B4FE8' }}>{s.value}</div>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 max-w-6xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ color: '#5B4FE8', backgroundColor: 'rgba(91,79,232,0.10)' }}>
            Platform Capabilities
          </div>
          <h2 className="text-4xl font-headline font-bold mb-4 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Everything you need to reach your dream rank
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            From adaptive AI practice to deep analytics — Concept Crack covers every angle of exam preparation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const iconColors = ['#5B4FE8', '#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];
            const bgColors = ['rgba(91,79,232,0.10)', 'rgba(124,58,237,0.10)', 'rgba(6,182,212,0.10)', 'rgba(16,185,129,0.10)', 'rgba(245,158,11,0.10)', 'rgba(139,92,246,0.10)'];
            return (
              <div
                key={f.title}
                className="rounded-xl p-6 group transition-all duration-200 hover:-translate-y-1"
                style={{
                  backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: bgColors[i % bgColors.length] }}
                >
                  <span className="material-symbols-outlined" style={{ color: iconColors[i % iconColors.length], fontSize: '22px' }}>{f.icon}</span>
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: isDark ? '#F9FAFB' : '#111827' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section
        id="testimonials"
        className="py-24"
        style={{ backgroundColor: isDark ? '#1A1929' : '#F9FAFB' }}
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ color: '#10B981', backgroundColor: 'rgba(16,185,129,0.10)' }}>
              Student Stories
            </div>
            <h2 className="text-4xl font-headline font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Trusted by toppers across India
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <figure
                key={t.name}
                className="rounded-xl p-6 flex flex-col"
                style={{
                  backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex mb-4 gap-0.5">
                  {[1,2,3,4,5].map(i => <span key={i} className="material-symbols-outlined filled text-amber-400" style={{ fontSize: '16px' }}>star</span>)}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed mb-5" style={{ color: isDark ? '#D1D5DB' : '#374151' }}>
                  "{t.quote}"
                </blockquote>
                <figcaption className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>{t.name}</div>
                    <div className="text-xs" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <section
        id="faq"
        className="py-24"
        style={{ backgroundColor: isDark ? '#1A1929' : '#F9FAFB' }}
      >
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-headline font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF', border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}` }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>{item.q}</span>
                  <span
                    className="material-symbols-outlined shrink-0 transition-transform duration-200"
                    style={{ fontSize: '20px', color: '#5B4FE8', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}
                  >
                    expand_more
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 max-w-4xl mx-auto px-6 text-center">
        <div
          className="rounded-3xl p-16"
          style={{ background: 'linear-gradient(135deg, #5B4FE8 0%, #7C3AED 60%, #06B6D4 100%)', boxShadow: '0 16px 64px rgba(91,79,232,0.40)' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <span className="material-symbols-outlined filled" style={{ fontSize: '14px' }}>auto_awesome</span>
            Start your journey today
          </div>
          <h2 className="text-4xl font-headline font-extrabold text-white mb-4 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Ready to crack your exam?
          </h2>
          <p className="text-lg mb-10 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Join 2M+ students who are already using AI-powered preparation to reach their dream rank.
          </p>
          <Link
            to={pathFor('login')}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl text-base font-semibold text-[#5B4FE8] bg-white transition-all hover:-translate-y-0.5"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.20)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ── Collab strip ── */}
      <div className="py-6 text-center" style={{ borderTop: `1px solid ${isDark ? '#1E1D2E' : '#E5E7EB'}` }}>
        <p className="text-sm" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
          Have a project in mind?{' '}
          <a
            href="mailto:mishrasatarupa360@gmail.com"
            className="font-semibold hover:underline transition-colors"
            style={{ color: '#5B4FE8' }}
          >
            Contact us for collaborations.
          </a>
        </p>
      </div>

      {/* ── Footer ── */}
      <footer
        className="py-10 px-6 lg:px-10"
        style={{ backgroundColor: isDark ? '#0F0E17' : '#111827', borderTop: `1px solid ${isDark ? '#1E1D2E' : '#1F2937'}` }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo.png" alt="Concept Crack" className="w-8 h-8 rounded-lg object-cover" />
                <span className="font-headline font-bold text-white text-base" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Concept Crack</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#9CA3AF' }}>
                AI-powered exam preparation platform for JEE, NEET, UPSC, and CAT.
              </p>
            </div>
            {[
              { title: 'Product', links: [
                { label: 'Features', href: '#features' },
                { label: 'Question Bank', href: '#features' },
                { label: 'Mock Tests', href: '#features' },
                { label: 'AI Insights', href: '#features' },
              ] },
              { title: 'Company', links: [
                { label: 'About', href: '#stats' },
                { label: 'Why Concept Crack', href: '#stats' },
                { label: 'Careers', href: 'mailto:careers@conceptcrack.app' },
                { label: 'Contact', href: 'mailto:support@conceptcrack.app' },
              ] },
              { title: 'Legal', links: [
                { label: 'Privacy Policy', href: '#faq' },
                { label: 'Terms of Service', href: '#faq' },
                { label: 'Refund Policy', href: '#faq' },
              ] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l.label}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: '#9CA3AF' }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6" style={{ borderTop: '1px solid #1F2937' }}>
            <p className="text-xs" style={{ color: '#6B7280' }}>© 2026 Concept Crack. All rights reserved.</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Made with ♥ for students across India</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
