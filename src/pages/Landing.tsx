import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { pathFor } from '../lib/pages';
import Logo from '../components/Logo';
import BookHero from '../components/BookHero';
import { features } from '../mocks';
import { useTheme } from '../lib/theme';

const pricingPlans = [
  {
    name: 'Basic',
    price: 199,
    tagline: 'For students who primarily need mock tests and performance tracking.',
    recommended: false,
    features: [
      'Full-length Mock Tests',
      'Chapter & Topic-wise Tests',
      'CBT Simulation',
      'Performance Analytics',
      'Review Log',
      'Basic Progress Tracking',
    ],
  },
  {
    name: 'Pro',
    price: 499,
    tagline: 'Our most popular plan — full AI mentorship and a personalized study path.',
    recommended: true,
    features: [
      'Everything in the Basic Plan',
      'AI Academic Mentor',
      'Personalized Learning Path',
      'Adaptive Practice Questions',
      'Concept-wise Weakness Detection',
      'AI-Based Study Recommendations',
      'Smart Revision Plans',
      'Advanced Academic Analytics',
    ],
  },
  {
    name: 'Premium',
    price: 999,
    tagline: 'Designed for students preparing for top ranks.',
    recommended: false,
    features: [
      'Everything in the Pro Plan',
      'Higher AI Usage Limits',
      'Advanced Behavioural Analytics',
      'Priority AI Response',
      'Personalized AI Study Planner',
      'Exclusive Features & Early Access',
      'Priority Customer Support',
    ],
  },
];

const faqItems = [
  { q: 'Which exams does Concept Crack cover?', a: 'Concept Crack supports JEE (Main + Advanced) and NEET UG, with subjects, chapters and mock-test patterns tailored to each.' },
  { q: 'How does the AI adaptive engine work?', a: 'Our AI analyzes every answer you give — time spent, accuracy pattern, error type — and builds a real-time model of your strengths and gaps to recommend exactly what to practice next.' },
  { q: 'Can I use Concept Crack on mobile?', a: 'Yes. The web app is fully responsive and works on all modern browsers.' },
  { q: 'How are mock tests created?', a: 'Full-length mock tests are assembled fresh from the question bank following the real JEE/NEET pattern, with no repeated questions in a paper.' },
];

const aiRoleBenefits = [
  {
    role: 'Students',
    icon: 'school',
    color: '#5B4FE8',
    points: [
      'An AI Companion that reviews every test, explains what you got wrong, and tells you exactly what to study next.',
      'Adaptive practice that detects weak concepts in real time and drills them until they stick.',
      'Personalised study plans, smart revision schedules and AI-generated tests matched to your level.',
    ],
  },
  {
    role: 'Parents',
    icon: 'family_restroom',
    color: '#06B6D4',
    points: [
      'Plain-language AI reports on your child’s strengths, gaps and study engagement — no syllabus knowledge needed.',
      'Progress and time-on-task insights, so you see real effort and not just marks.',
      'Early signals when performance dips, so you can step in at the right moment.',
    ],
  },
  {
    role: 'Faculty',
    icon: 'groups',
    color: '#7C3AED',
    points: [
      'Build exam-ready tests from the question bank in seconds with AI assistance.',
      'Automatic class-wide weakness detection that shows exactly which topics to reteach.',
      'AI-summarised performance reports per student and per chapter, ready to act on.',
    ],
  },
  {
    role: 'Administrators',
    icon: 'admin_panel_settings',
    color: '#10B981',
    points: [
      'Institution-wide analytics with AI-generated performance summaries across cohorts.',
      'Automated report generation and oversight of tests, approvals and faculty activity.',
      'Data-driven insight into trends and outcomes to guide decisions.',
    ],
  },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (!mobileNavOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavOpen]);

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: isDark ? '#0F0E17' : '#FFFFFF', color: isDark ? '#F9FAFB' : '#111827' }}
    >
      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-10 gap-3"
        style={{
          height: '64px',
          backgroundColor: isDark ? 'rgba(15,14,23,0.90)' : 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
          position: 'sticky',
        }}
      >
        <div className="flex items-center gap-3">
          <Link to={pathFor('landing')} className="flex items-center gap-2.5">
            <Logo size="sm" tone="theme" />
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
          {navLinks.map(item => (
            <a key={item.href} href={item.href} className="hover:text-[#5B4FE8] transition-colors">{item.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => setMobileNavOpen(o => !o)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors lg:hidden"
            style={{ color: isDark ? '#9CA3AF' : '#6B7280', backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6' }}
            title={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {mobileNavOpen ? 'close' : 'menu'}
            </span>
          </button>
          <Link
            to={pathFor('login')}
            className="hidden sm:flex h-9 px-4 rounded-lg text-sm font-semibold items-center transition-colors"
            style={{ color: isDark ? '#E5E7EB' : '#374151', backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6' }}
          >
            Log in
          </Link>
          <Link
            to={pathFor('login')}
            className="hidden sm:flex h-9 px-4 rounded-lg text-sm font-semibold items-center text-white transition-all hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
          >
            Start Free Trial
          </Link>
        </div>

        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/45 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <div
          className={`absolute left-0 right-0 top-[64px] z-50 lg:hidden overflow-hidden transition-all duration-200 ${mobileNavOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          style={{
            backgroundColor: isDark ? 'rgba(15,14,23,0.98)' : 'rgba(255,255,255,0.98)',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="px-6 py-5 space-y-4">
            <div className="flex flex-col gap-2">
              {navLinks.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="py-2 text-sm font-semibold"
                  style={{ color: isDark ? '#E5E7EB' : '#374151' }}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to={pathFor('login')}
                className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors"
                style={{ color: isDark ? '#E5E7EB' : '#374151', backgroundColor: isDark ? '#1E1D2E' : '#F3F4F6' }}
                onClick={() => setMobileNavOpen(false)}
              >
                Log in
              </Link>
              <Link
                to={pathFor('login')}
                className="h-10 px-4 rounded-lg text-sm font-semibold flex items-center justify-center text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
                onClick={() => setMobileNavOpen(false)}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Cinematic AI study hero ── */}
      <BookHero isDark={isDark} />

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

      {/* ── AI features by role ── */}
      <section id="ai-features" className="py-24 max-w-6xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ color: '#5B4FE8', backgroundColor: 'rgba(91,79,232,0.10)' }}>
            AI, explained
          </div>
          <h2 className="text-3xl md:text-4xl font-headline font-bold mb-4 tracking-tight max-w-4xl mx-auto" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            What exactly do our AI features do, and how are they beneficial for students, parents, faculty, and administrators?
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
            One AI engine, four points of view — here’s what it does for each person in the Concept Crack ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {aiRoleBenefits.map(r => (
            <div
              key={r.role}
              className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1"
              style={{
                backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF',
                border: `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${r.color}1A` }}>
                  <span className="material-symbols-outlined" style={{ color: r.color, fontSize: '22px' }}>{r.icon}</span>
                </div>
                <h3 className="text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: isDark ? '#F9FAFB' : '#111827' }}>
                  For {r.role}
                </h3>
              </div>
              <ul className="space-y-3">
                {r.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: isDark ? '#B4B7C4' : '#4B5563' }}>
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px', color: r.color, marginTop: '1px' }}>auto_awesome</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="py-24"
        style={{ backgroundColor: isDark ? '#1A1929' : '#F9FAFB' }}
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ color: '#5B4FE8', backgroundColor: 'rgba(91,79,232,0.10)' }}>
              Pricing
            </div>
            <h2 className="text-4xl font-headline font-bold mb-4 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Plans built for every stage of your prep
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>
              Three tiers designed to meet you where you are — from focused mock-test practice to a fully personalized, AI-guided study experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {pricingPlans.map(plan => {
              const isPremium = plan.name === 'Premium';
              const GOLD = '#D4AF37';
              const goldGrad = 'linear-gradient(120deg, #9C7A1E 0%, #E7C15A 42%, #FBEEB5 52%, #C99A2E 72%, #9C7A1E 100%)';
              return (
              <div
                key={plan.name}
                className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
                style={{
                  backgroundColor: isDark ? '#1E1D2E' : '#FFFFFF',
                  border: isPremium
                    ? `1.5px solid ${GOLD}`
                    : plan.recommended ? '2px solid #5B4FE8' : `1px solid ${isDark ? '#2D2B42' : '#E5E7EB'}`,
                  boxShadow: isPremium
                    ? '0 14px 44px rgba(212,175,55,0.24)'
                    : plan.recommended ? '0 12px 40px rgba(91,79,232,0.30)' : (isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'),
                  transform: plan.recommended ? 'translateY(-8px)' : 'none',
                }}
              >
                <div
                  className="px-6 py-7 relative"
                  style={{
                    background: isPremium
                      ? 'linear-gradient(135deg, #17130A 0%, #2E2410 55%, #17130A 100%)'
                      : plan.recommended ? 'linear-gradient(135deg, #5B4FE8, #7C3AED)' : (isDark ? '#151426' : '#111827'),
                  }}
                >
                  {isPremium && <div className="absolute inset-x-0 top-0 h-px" style={{ background: goldGrad }} />}
                  {plan.recommended && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FDE68A' }}>
                      <span className="material-symbols-outlined filled" style={{ fontSize: '13px' }}>star</span>
                      Recommended
                    </div>
                  )}
                  {isPremium && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide mb-3" style={{ backgroundColor: 'rgba(212,175,55,0.16)', color: '#F5D67A', border: '1px solid rgba(212,175,55,0.35)' }}>
                      <span className="material-symbols-outlined filled" style={{ fontSize: '13px' }}>workspace_premium</span>
                      Premium
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{plan.name} Plan</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span
                      className="text-3xl font-extrabold"
                      style={isPremium
                        ? { background: goldGrad, backgroundSize: '200% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'ccShimmer 5s linear infinite' }
                        : { color: '#fff' }}
                    >₹{plan.price}</span>
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>/ month</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{plan.tagline}</p>
                </div>

                <ul className="p-6 space-y-3 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className="material-symbols-outlined filled shrink-0" style={{ fontSize: '18px', color: isPremium ? GOLD : '#10B981' }}>{isPremium ? 'workspace_premium' : 'check_circle'}</span>
                      <span style={{ color: isDark ? '#E5E7EB' : '#374151' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="p-6 pt-0">
                  <Link
                    to={pathFor('comingSoon')}
                    state={{ plan: plan.name }}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-px"
                    style={
                      isPremium
                        ? { background: goldGrad, backgroundSize: '200% auto', color: '#231A05', boxShadow: '0 4px 14px rgba(212,175,55,0.40)', animation: 'ccShimmer 5s linear infinite' }
                        : plan.recommended
                        ? { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', color: '#fff', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }
                        : { backgroundColor: isDark ? '#2D2B42' : '#F3F4F6', color: isDark ? '#E5E7EB' : '#374151' }
                    }
                  >
                    {isPremium && <span className="material-symbols-outlined filled" style={{ fontSize: '16px' }}>workspace_premium</span>}
                    Choose {plan.name}
                  </Link>
                </div>
              </div>
              );
            })}
          </div>

          {/* B2B strip */}
          <div
            className="mt-14 rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8"
            style={{ background: 'linear-gradient(135deg, #0F0E17 0%, #1E1D2E 100%)', border: `1px solid ${isDark ? '#2D2B42' : 'transparent'}` }}
          >
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3" style={{ backgroundColor: 'rgba(6,182,212,0.15)', color: '#06B6D4' }}>
                For Coaching Institutes
              </div>
              <h3 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                Bring AI-powered intelligence to your institute
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
                AI mentors, adaptive learning, CBT simulation, advanced analytics, parent &amp; faculty dashboards, question bank management, and white-label deployment — final pricing customized to your student strength and institutional needs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to={pathFor('contact')}
                className="h-11 px-6 rounded-xl text-sm font-semibold text-[#0F0E17] bg-white flex items-center gap-2 transition-all hover:-translate-y-px"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>calendar_month</span>
                Book a Demo
              </Link>
              <Link
                to={pathFor('contact')}
                className="h-11 px-6 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all hover:-translate-y-px"
                style={{ border: '1px solid rgba(255,255,255,0.25)' }}
              >
                Request a Custom Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        id="faq"
        className="py-24"
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
            Start your AI-powered JEE &amp; NEET preparation and reach your dream rank.
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

      {/* ── Footer ── */}
      <footer
        className="py-10 px-6 lg:px-10"
        style={{ backgroundColor: isDark ? '#0F0E17' : '#111827', borderTop: `1px solid ${isDark ? '#1E1D2E' : '#1F2937'}` }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <Logo size="md" tone="onDark" />
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#9CA3AF' }}>
                AI-powered exam preparation platform for JEE and NEET.
              </p>
            </div>
            {[
              { title: 'Product', links: [
                { label: 'Features', href: '#features' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'Question Bank', href: '/question-bank' },
                { label: 'Mock Tests', href: '/mock-tests' },
              ] },
              { title: 'Company', links: [
                { label: 'About', href: '/about' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Careers', href: '/careers' },
                { label: 'Contact', href: '/contact' },
              ] },
              { title: 'Legal', links: [
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Refund Policy', href: '/refund' },
              ] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l.label}>
                      {l.href.startsWith('/') ? (
                        <Link to={l.href} className="text-sm transition-colors hover:text-white" style={{ color: '#9CA3AF' }}>
                          {l.label}
                        </Link>
                      ) : (
                        <a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: '#9CA3AF' }}>
                          {l.label}
                        </a>
                      )}
                    </li>
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
