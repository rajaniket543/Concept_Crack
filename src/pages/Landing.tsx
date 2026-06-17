import { Link } from 'react-router-dom';
import { pathFor } from '../lib/pages';
import { features, stats, testimonials } from '../mocks';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Top bar */}
      <header className="px-container-desktop py-5 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest">
        <Link to={pathFor('landing')} className="flex items-center gap-2 font-extrabold text-lg">
          <span className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary">psychology</span>
          </span>
          PrepMind AI
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-label-lg text-on-surface-variant">
          <a href="#features" className="hover:text-on-surface">Features</a>
          <a href="#testimonials" className="hover:text-on-surface">Testimonials</a>
          <a href="#stats" className="hover:text-on-surface">Stats</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to={pathFor('login')}
            className="h-10 px-4 inline-flex items-center rounded font-semibold text-label-lg text-on-surface hover:bg-surface-container"
          >
            Sign in
          </Link>
          <Link
            to={pathFor('login')}
            className="h-10 px-4 inline-flex items-center rounded font-semibold text-label-lg bg-primary text-on-primary hover:bg-primary-container"
          >
            Start free trial
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-container-desktop py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/15 text-secondary text-label-md font-semibold mb-6">
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            AI-POWERED LEARNING
          </div>
          <h1 className="text-display-lg text-on-surface leading-[64px] tracking-tight">
            Learn smarter,<br />
            <span className="text-secondary">not harder.</span>
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-6 max-w-xl">
            PrepMind AI builds a personalized study plan for every student, adapts in real time to your strengths and gaps,
            and gets you exam-ready with predictive analytics.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              to={pathFor('login')}
              className="h-12 px-6 inline-flex items-center gap-2 rounded font-semibold text-label-lg bg-primary text-on-primary hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
              Get started free
            </Link>
            <Link
              to={pathFor('login')}
              className="h-12 px-6 inline-flex items-center gap-2 rounded font-semibold text-label-lg border border-outline text-on-surface hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              Explore simulator
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-primary to-secondary-container shadow-elev-3 p-8 text-on-primary flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="text-label-md uppercase tracking-widest opacity-80">Live AI Insight</div>
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <div className="text-headline-lg-mobile">Your retention is 87%</div>
              <div className="text-body-md opacity-80 mt-1">
                Suggested: 12 questions in Electrostatics · 8 in Optics
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => {
                const tone = (i * 13) % 7;
                const colors = [
                  'bg-on-primary/10',
                  'bg-on-primary/25',
                  'bg-tertiary-fixed/40',
                  'bg-tertiary-fixed/65',
                  'bg-tertiary-fixed/85',
                  'bg-tertiary-fixed',
                  'bg-secondary-container',
                ];
                return <div key={i} className={`h-4 rounded ${colors[tone]}`} />;
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-container-desktop py-20">
        <div className="max-w-2xl mb-12">
          <div className="text-label-md uppercase tracking-widest text-secondary font-bold mb-3">Why PrepMind</div>
          <h2 className="text-headline-lg text-on-surface">Everything you need to go from syllabus to selection.</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-card shadow-elev-1"
            >
              <div className="w-11 h-11 rounded-md bg-primary-fixed text-primary flex items-center justify-center mb-4">
                <span className="material-symbols-outlined">{f.icon}</span>
              </div>
              <h3 className="text-title-lg text-on-surface">{f.title}</h3>
              <p className="text-body-md text-on-surface-variant mt-2">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="px-container-desktop py-16">
        <div className="bg-primary text-on-primary rounded-xl p-card grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-headline-lg">{s.value}</div>
              <div className="text-label-md uppercase tracking-widest opacity-80 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="px-container-desktop py-20">
        <div className="max-w-2xl mb-12">
          <div className="text-label-md uppercase tracking-widest text-secondary font-bold mb-3">What people say</div>
          <h2 className="text-headline-lg text-on-surface">Trusted by students, parents, and faculty.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-card shadow-elev-1"
            >
              <blockquote className="text-body-lg text-on-surface">"{t.quote}"</blockquote>
              <figcaption className="flex items-center gap-3 mt-6">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center">
                  {t.initials}
                </div>
                <div>
                  <div className="text-label-lg text-on-surface">{t.name}</div>
                  <div className="text-label-md text-on-surface-variant">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-container-desktop py-20">
        <div className="bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-xl p-12 text-center">
          <h2 className="text-headline-lg">Ready to study smarter?</h2>
          <p className="text-body-lg opacity-80 mt-3 max-w-2xl mx-auto">
            Join 1.2 million learners and 420+ institutes using PrepMind AI to unlock their potential.
          </p>
          <div className="mt-8">
            <Link
              to={pathFor('login')}
              className="h-12 px-6 inline-flex items-center gap-2 rounded font-semibold text-label-lg bg-secondary text-on-secondary hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-container-desktop py-8 border-t border-outline-variant text-label-md text-on-surface-variant flex flex-col md:flex-row items-center justify-between gap-2">
        <div>© 2026 PrepMind AI · All rights reserved</div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-on-surface">Privacy</a>
          <a href="#" className="hover:text-on-surface">Terms</a>
          <a href="#" className="hover:text-on-surface">Contact</a>
        </div>
      </footer>
    </div>
  );
}
