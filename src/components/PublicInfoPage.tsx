import { Link } from 'react-router-dom';
import Logo from './Logo';

export interface PublicInfoSection {
  title: string;
  body: string;
  bullets?: string[];
}

interface PublicInfoPageProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlight?: string;
  sections: PublicInfoSection[];
  recommended?: string[];
}

export default function PublicInfoPage({
  eyebrow,
  title,
  subtitle,
  highlight,
  sections,
  recommended = [],
}: PublicInfoPageProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
      <header
        className="flex items-center justify-between px-4 sm:px-6 lg:px-10"
        style={{
          height: '64px',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <Logo size="sm" tone="theme" />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/contact"
            className="hidden sm:inline-flex h-9 px-4 rounded-lg text-sm font-semibold items-center transition-colors"
            style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-muted)' }}
          >
            Contact
          </Link>
          <Link
            to="/login"
            className="h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', boxShadow: '0 4px 12px rgba(91,79,232,0.35)' }}
          >
            Start Free Trial
          </Link>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 py-10 lg:py-16">
        <div className="max-w-6xl mx-auto space-y-8">
          <section
            className="rounded-[28px] p-6 sm:p-8 lg:p-10 overflow-hidden relative"
            style={{
              background: 'linear-gradient(135deg, rgba(91,79,232,0.10), rgba(6,182,212,0.08), rgba(15,14,23,0.96))',
              border: '1px solid rgba(91,79,232,0.18)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.18)',
            }}
          >
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-25" style={{ background: 'radial-gradient(circle, #5B4FE8, transparent)' }} />
              <div className="absolute -bottom-24 left-8 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} />
            </div>

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-5" style={{ backgroundColor: 'rgba(91,79,232,0.14)', border: '1px solid rgba(91,79,232,0.24)', color: '#8FB4FF' }}>
                <span className="material-symbols-outlined filled" style={{ fontSize: '14px' }}>auto_awesome</span>
                {eyebrow}
              </div>
              <h1 className="text-4xl sm:text-5xl font-headline font-extrabold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.04em' }}>
                {title}
              </h1>
              <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
              {highlight && (
                <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-inverse)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#F5D67A' }}>star</span>
                  {highlight}
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6">
            <div className="space-y-4">
              {sections.map(section => (
                <article
                  key={section.title}
                  className="rounded-2xl p-6"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <h2 className="text-xl font-headline font-bold mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {section.title}
                  </h2>
                  <p className="text-body-md leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {section.body}
                  </p>
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {section.bullets.map(item => (
                        <li key={item} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '18px', color: '#5B4FE8' }}>check_circle</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>

            <aside className="space-y-4">
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'linear-gradient(180deg, rgba(91,79,232,0.10), rgba(15,14,23,0.96))',
                  border: '1px solid rgba(91,79,232,0.18)',
                }}
              >
                <h2 className="text-lg font-headline font-bold mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Recommended next steps
                </h2>
                <ul className="space-y-3">
                  {recommended.length > 0 ? recommended.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      <span className="material-symbols-outlined mt-0.5" style={{ fontSize: '18px', color: '#06B6D4' }}>auto_awesome</span>
                      <span>{item}</span>
                    </li>
                  )) : (
                    <li className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Explore the linked pages below to continue.
                    </li>
                  )}
                </ul>
              </div>

              <div
                className="rounded-2xl p-6"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h2 className="text-lg font-headline font-bold mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Want to go deeper?
                </h2>
                <div className="space-y-2">
                  <Link to="/login" className="btn-primary btn-md w-full justify-center">Start Free Trial</Link>
                  <Link to="/contact" className="btn-outline btn-md w-full justify-center">Contact Support</Link>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}
