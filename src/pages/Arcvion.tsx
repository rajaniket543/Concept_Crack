import { Link } from 'react-router-dom';

const ARCVION_URL   = 'https://arcvion.in';
const ARCVION_EMAIL = 'contact@arcvion.in';
const ARCVION_LI    = 'https://www.linkedin.com/company/arcvion';

const SERVICES = [
  { icon: 'auto_awesome',     title: 'AI Solutions',            desc: 'LLM apps, chatbots, recommendation engines and intelligent automation tailored to your domain.' },
  { icon: 'language',         title: 'Web Development',         desc: 'Fast, responsive, production-grade web apps built with modern frameworks and clean architecture.' },
  { icon: 'smartphone',       title: 'Mobile App Development',  desc: 'Cross-platform iOS & Android apps with native-quality UX and offline-first performance.' },
  { icon: 'cloud',            title: 'Cloud Solutions',         desc: 'Scalable cloud infrastructure, CI/CD, containerisation and cost-optimised deployments.' },
  { icon: 'terminal',         title: 'Custom Software',         desc: 'End-to-end bespoke software engineered around your exact business workflows.' },
];

const TECH = [
  { icon: 'code',        label: 'React + TypeScript' },
  { icon: 'bolt',        label: 'Vite' },
  { icon: 'style',       label: 'Tailwind CSS' },
  { icon: 'dns',         label: 'Node.js / Express' },
  { icon: 'database',    label: 'PostgreSQL' },
  { icon: 'local_fire_department', label: 'Firebase' },
  { icon: 'auto_awesome', label: 'Gemini AI' },
  { icon: 'cloud',       label: 'Render Cloud' },
];

const PROCESS = ['Idea', 'Design', 'Development', 'Testing', 'Deployment', 'Support'];
const PROCESS_ICONS: Record<string, string> = {
  Idea: 'lightbulb', Design: 'draw', Development: 'code', Testing: 'bug_report', Deployment: 'rocket_launch', Support: 'support_agent',
};

function Reveal({ delay = 0, children, className = '' }: { delay?: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={`arcvion-reveal ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

export default function Arcvion() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
      <style>{`
        @keyframes arcvion-fade-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .arcvion-reveal { animation: arcvion-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .arcvion-card { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
        .arcvion-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(91,79,232,0.16); border-color: rgba(91,79,232,0.45) !important; }
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 h-16" style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Concept Crack
        </Link>
        <a href={ARCVION_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline" style={{ color: '#5B4FE8' }}>
          arcvion.in ↗
        </a>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 text-center" style={{ background: 'linear-gradient(160deg, #0F0E17 0%, #1A1929 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-10 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <Reveal>
            <ArcvionLogo />
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mt-6 mb-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>
              Software, engineered with intent.
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-lg" style={{ color: '#9CA3AF' }}>
              Arcvion is a product & software studio building AI-first web, mobile and cloud solutions — including the very platform you're using.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <a href={ARCVION_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-8 px-6 h-12 rounded-xl font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 8px 24px rgba(91,79,232,0.4)' }}>
              Visit arcvion.in
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_outward</span>
            </a>
          </Reveal>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">
        {/* Who we are / What we build / Our mission */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: 'groups',   title: 'Who we are',    body: 'A compact team of engineers and designers who care deeply about craft, performance and real-world impact.' },
            { icon: 'build',    title: 'What we build', body: 'AI-powered products, web & mobile apps, and custom software that turn ambitious ideas into shipped reality.' },
            { icon: 'flag',     title: 'Our mission',   body: 'To make powerful, intelligent software accessible — helping businesses and learners do more with technology.' },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <div className="arcvion-card h-full rounded-2xl p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(91,79,232,0.12)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#5B4FE8' }}>{c.icon}</span>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{c.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.body}</p>
              </div>
            </Reveal>
          ))}
        </section>

        {/* Services */}
        <section>
          <Reveal><SectionHeading eyebrow="What we do" title="Services" /></Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="arcvion-card h-full rounded-2xl p-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                    <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>{s.icon}</span>
                  </div>
                  <h3 className="text-base font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Why we built this platform */}
        <section>
          <Reveal>
            <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, rgba(91,79,232,0.08), rgba(124,58,237,0.05))', border: '1px solid rgba(91,79,232,0.20)', borderLeft: '3px solid #5B4FE8' }}>
              <SectionHeading eyebrow="The story" title="Why we built this platform" />
              <p className="text-base leading-relaxed mt-4" style={{ color: 'var(--text-secondary)' }}>
                Concept Crack is one of Arcvion's products — built to improve digital learning for competitive-exam aspirants.
                We wanted to show what thoughtful, AI-driven education software can feel like: adaptive practice, honest analytics,
                real-time proctoring and an AI tutor that actually understands a student's performance. It's equal parts a
                learning platform and a demonstration of the software we build for clients.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Technology stack */}
        <section>
          <Reveal><SectionHeading eyebrow="Under the hood" title="Technology stack" /></Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {TECH.map((t, i) => (
              <Reveal key={t.label} delay={i * 0.05}>
                <div className="arcvion-card rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#5B4FE8' }}>{t.icon}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Our process */}
        <section>
          <Reveal><SectionHeading eyebrow="How we work" title="Our process" /></Reveal>
          <div className="flex flex-wrap items-stretch gap-3 mt-8">
            {PROCESS.map((step, i) => (
              <Reveal key={step} delay={i * 0.08} className="flex-1 min-w-[140px]">
                <div className="arcvion-card h-full rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-9 h-9 rounded-lg mx-auto flex items-center justify-center mb-2" style={{ backgroundColor: 'rgba(91,79,232,0.12)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#5B4FE8' }}>{PROCESS_ICONS[step]}</span>
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Step {i + 1}</div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{step}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <Reveal>
          <section className="rounded-2xl p-10 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Looking to build your own software?
            </h2>
            <p className="text-white/80 mb-6 max-w-xl mx-auto">
              From AI products to full-scale platforms — let's turn your idea into a polished, production-ready product.
            </p>
            <a href={ARCVION_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 h-12 rounded-xl font-semibold transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: '#fff', color: '#5B4FE8' }}>
              Visit arcvion.in
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_outward</span>
            </a>
          </section>
        </Reveal>

        {/* Contact */}
        <section>
          <Reveal><SectionHeading eyebrow="Say hello" title="Get in touch" /></Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { icon: 'language', label: 'Website',  value: 'arcvion.in',        href: ARCVION_URL },
              { icon: 'mail',     label: 'Email',    value: ARCVION_EMAIL,       href: `mailto:${ARCVION_EMAIL}` },
              { icon: 'work',     label: 'LinkedIn', value: 'Arcvion',           href: ARCVION_LI },
            ].map((c, i) => (
              <Reveal key={c.label} delay={i * 0.08}>
                <a href={c.href} target="_blank" rel="noopener noreferrer"
                  className="arcvion-card flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(91,79,232,0.12)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#5B4FE8' }}>{c.icon}</span>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{c.label}</div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.value}</div>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      </div>

      {/* Page footer credit */}
      <footer className="py-8 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Built with <span style={{ color: '#F43F5E' }}>❤</span> by{' '}
          <a href={ARCVION_URL} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: '#5B4FE8' }}>Arcvion</a>
        </p>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#5B4FE8' }}>{eyebrow}</div>
      <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>{title}</h2>
    </div>
  );
}

function ArcvionLogo() {
  return (
    <div className="inline-flex items-center gap-3">
      <img
        src="/arcvion-logo.png"
        alt="Arcvion"
        onError={(e) => { const el = e.currentTarget as HTMLImageElement; el.style.display = 'none'; (el.nextElementSibling as HTMLElement).style.display = 'flex'; }}
        className="w-12 h-12 rounded-xl object-contain"
      />
      <span
        className="w-12 h-12 rounded-xl items-center justify-center text-white text-2xl font-black"
        style={{ display: 'none', background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >A</span>
      <span className="text-3xl font-black text-white" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>Arcvion</span>
    </div>
  );
}
