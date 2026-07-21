import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ARCVION_URL } from './Arcvion';
import { useMagneticHover } from './heroInteractions';
import './ArcvionSection.css';

/**
 * The Arcvion company-profile block on the landing page — the parent-company
 * story that frames Concept Crack as one product inside a wider ecosystem.
 *
 * Always renders dark in both site themes: it reads as a deliberate inset
 * surface (the Stripe/Vercel embedded-panel pattern) rather than a section that
 * failed to theme. Palette stays within the existing Concept Crack brand.
 */

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shared reveal registry.
 *
 * Deliberately NOT IntersectionObserver: IO only reports threshold *changes*, so
 * an element that goes from below the viewport to above it inside a single frame
 * — a trackpad flick, an anchor jump, restoring scroll position on reload —
 * never fires a callback and its content stays permanently invisible. A plain
 * position check can't miss that case.
 *
 * One rAF-throttled passive listener serves every element, and it detaches
 * itself as soon as nothing is left pending, so the steady-state cost is zero.
 */
type Pending = { el: HTMLElement; show: () => void };

const pendingReveals = new Set<Pending>();
let revealRaf = 0;
let revealListening = false;

function flushReveals() {
  revealRaf = 0;
  const vh = window.innerHeight;
  pendingReveals.forEach(p => {
    const rect = p.el.getBoundingClientRect();
    // top < viewport height covers both "has scrolled into view" and
    // "was skipped over and is now above the fold".
    if (rect.top < vh - 40) {
      p.show();
      pendingReveals.delete(p);
    }
  });
  if (pendingReveals.size === 0) stopRevealLoop();
}

function scheduleReveals() {
  if (revealRaf) return;
  revealRaf = requestAnimationFrame(flushReveals);
}

function startRevealLoop() {
  if (revealListening) return;
  revealListening = true;
  window.addEventListener('scroll', scheduleReveals, { passive: true });
  window.addEventListener('resize', scheduleReveals, { passive: true });
}

function stopRevealLoop() {
  if (!revealListening) return;
  revealListening = false;
  window.removeEventListener('scroll', scheduleReveals);
  window.removeEventListener('resize', scheduleReveals);
}

/** Adds `is-visible` the first time an element reaches the viewport. */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { setVisible(true); return; }

    const entry: Pending = { el, show: () => setVisible(true) };
    pendingReveals.add(entry);
    startRevealLoop();
    scheduleReveals(); // evaluate immediately for anything already on screen

    return () => {
      pendingReveals.delete(entry);
      if (pendingReveals.size === 0) stopRevealLoop();
    };
  }, []);

  return { ref, visible };
}

/** Wrapper that fades/blurs its children up on first scroll-in. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`arc-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Counts 0 → `value` once visible. Falls back to the final value instantly when reduced-motion is set. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (prefersReducedMotion()) { setN(value); return; }

    let raf = 0;
    const start = performance.now();
    const DURATION = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setN(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, value]);

  return <span ref={ref}>{n}{suffix}</span>;
}

const STATS: Array<{ label: string; value: string; count?: number; suffix?: string }> = [
  { label: 'Products Built', value: '', count: 1, suffix: '+' },
  { label: 'Technologies',   value: 'AI • Robotics • Web' },
  { label: 'Platform',       value: 'Education' },
  { label: 'Founded',        value: '', count: 2026 },
  { label: 'Status',         value: 'Building' },
  { label: 'Mission',        value: 'Scale Globally' },
];

const ECOSYSTEM = [
  { name: 'Concept Crack',       note: 'AI Learning Platform', state: 'live' },
  { name: 'Drone Infrastructure', note: 'Coming Soon',          state: 'planned' },
  { name: 'Attendance AI',        note: 'In Development',       state: 'planned' },
  { name: 'Robotics Platform',    note: 'Research',             state: 'planned' },
  { name: 'Future Products',      note: 'Growing…',             state: 'planned' },
];


const VALUES = [
  { icon: 'lightbulb',    title: 'Innovation', body: 'We solve meaningful problems using engineering.' },
  { icon: 'auto_awesome', title: 'Simplicity', body: 'Technology should be powerful yet effortless.' },
  { icon: 'public',       title: 'Scale',      body: 'Every product is designed to serve millions.' },
];

const CHAIN = ['Arcvion', 'Concept Crack', 'Students', 'Success'];

const PROFILE_ROWS: Array<{ key: string; value: ReactNode }> = [
  { key: 'Focus', value: 'Artificial Intelligence · Education · Robotics · Automation' },
  { key: 'Flagship Product', value: 'Concept Crack' },
  { key: 'Mission', value: 'Engineering Tomorrow' },
  { key: 'Website', value: 'arcvion.in' },
];

/** Tiny drifting dots — deterministic so they don't reshuffle on every render. */
const DOTS = Array.from({ length: 18 }, (_, i) => {
  const frac = (x: number) => x - Math.floor(x);
  return {
    left: frac(i * 0.61803) * 96 + 2,
    top: frac(i * 0.37) * 90 + 5,
    dur: 16 + frac(i * 0.53) * 16,
    delay: -frac(i * 0.87) * 28,
    dx: (frac(i * 0.29) - 0.5) * 80,
  };
});

export default function ArcvionSection() {
  const primaryCta = useRef<HTMLAnchorElement>(null);
  useMagneticHover(primaryCta, 8);

  // Swap in a real logo file if one has been added to /public.
  const [hasLogo, setHasLogo] = useState(true);

  const dots = useMemo(() => DOTS, []);

  return (
    <section className="arc" id="arcvion" aria-labelledby="arcvion-heading">
      {/* ── Background ── */}
      <div className="arc-bg" aria-hidden="true">
        <div className="arc-aurora" />
        <div className="arc-grid" />
        <div className="arc-blob arc-blob-a" />
        <div className="arc-blob arc-blob-b" />
        {dots.map((d, i) => (
          <span
            key={i}
            className="arc-dot"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
              '--arc-dx': `${d.dx}px`,
            } as CSSProperties}
          />
        ))}
        <div className="arc-noise" />
      </div>

      <div className="arc-inner">
        {/* ── Heading + hero statement ── */}
        <Reveal>
          <p className="arc-eyebrow">The company behind Concept Crack</p>
          <h2 className="arc-h2" id="arcvion-heading">
            One Product.<br />
            <span className="arc-grad">Infinite Possibilities.</span>
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="arc-hero-statement">
            Arcvion builds intelligent software and robotics infrastructure designed for the
            next generation of education, automation and aerial systems.
          </p>
        </Reveal>

        {/* ── Supporting paragraphs ── */}
        <Reveal delay={140}>
          <div className="arc-block" style={{ marginTop: 40 }}>
            <p className="arc-lede">
              Arcvion is a technology company focused on building intelligent products that solve
              real-world problems.
            </p>
            <p className="arc-lede">
              From AI-powered education platforms to robotics infrastructure, attendance automation
              and future drone ecosystems, we engineer products that combine simplicity, performance
              and scalable architecture.
            </p>
            <p className="arc-lede">
              Concept Crack is our flagship learning platform, designed to help students prepare
              smarter using technology.
            </p>
          </div>
        </Reveal>

        {/* ── Stats ── */}
        <Reveal delay={60}>
          <div className="arc-block">
            <div className="arc-stats">
              {STATS.map(s => (
                <div className="arc-stat" key={s.label}>
                  <div className="arc-stat-label">{s.label}</div>
                  <div className={`arc-stat-value ${s.count === undefined ? 'is-text' : ''}`}>
                    {s.count !== undefined
                      ? <CountUp value={s.count} suffix={s.suffix} />
                      : s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── Ecosystem ── */}
        <div className="arc-block">
          <Reveal><p className="arc-section-label">Arcvion Ecosystem</p></Reveal>
          <div className="arc-eco">
            {ECOSYSTEM.map((p, i) => (
              <Reveal key={p.name} delay={i * 70}>
                <div className="arc-card arc-eco-card" data-state={p.state}>
                  <div className="arc-eco-dot" />
                  <h3 className="arc-h3">{p.name}</h3>
                  <p className="arc-eco-status">{p.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Philosophy ── */}
        <div className="arc-block">
          <div className="arc-quote">
            <Reveal>
              <p className="arc-quote-line">We don’t build products.</p>
            </Reveal>
            <Reveal delay={140}>
              <p className="arc-quote-line arc-grad">We build technology that empowers people.</p>
            </Reveal>
            <Reveal delay={280}>
              <p className="arc-quote-sub">
                Every product we launch is designed with one goal — make technology more intelligent,
                more accessible, and more impactful.
              </p>
            </Reveal>
          </div>
        </div>

        {/* ── Why Arcvion exists ── */}
        <div className="arc-block">
          <Reveal><p className="arc-section-label">Why Arcvion exists</p></Reveal>
          <div className="arc-eco">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 110}>
                <div className="arc-card" style={{ padding: '26px 22px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#8B5CF6' }}>{v.icon}</span>
                  <h3 className="arc-h3" style={{ marginTop: 14 }}>{v.title}</h3>
                  <p className="arc-eco-status" style={{ lineHeight: 1.6 }}>{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Relationship chain ── */}
        <div className="arc-block">
          <Reveal>
            <div className="arc-chain">
              {CHAIN.map((node, i) => (
                <span key={node} style={{ display: 'contents' }}>
                  <span className="arc-chain-node">{node}</span>
                  {i < CHAIN.length - 1 && <span className="arc-chain-link" aria-hidden="true" />}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* ── Profile card + founder message ── */}
        <div className="arc-block" style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <Reveal>
            <div className="arc-card arc-profile">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingBottom: 18 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 20, fontWeight: 800, letterSpacing: '0.10em' }}>
                    ARCVION
                  </div>
                  <div style={{ fontSize: 12, color: '#6E6C85', marginTop: 3 }}>Technology Company</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10B981', marginTop: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#10B981', display: 'inline-block' }} />
                    Active
                  </span>
                </div>
                {hasLogo && (
                  <img
                    src="/logo_arcvion.jpg"
                    alt=""
                    aria-hidden="true"
                    width={1600}
                    height={508}
                    className="arc-corner-logo"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
              {PROFILE_ROWS.map(r => (
                <div className="arc-profile-row" key={r.key}>
                  <span className="arc-profile-key">{r.key}</span>
                  <span className="arc-profile-val">{r.value}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div style={{ padding: '4px 0' }}>
              <p className="arc-section-label" style={{ marginBottom: 18 }}>From the founder</p>
              <p className="arc-lede">
                At Arcvion, we believe technology should remove barriers, not create them.
              </p>
              <p className="arc-lede">
                Every product we build starts with a simple question — how can we make someone’s
                life better?
              </p>
              <p className="arc-lede" style={{ color: '#C4B5FD' }}>
                Concept Crack is just the beginning.
              </p>
            </div>
          </Reveal>
        </div>

        {/* ── Logo lockup ── */}
        <div className="arc-block" style={{ textAlign: 'center' }}>
          <Reveal>
            <p className="arc-section-label" style={{ marginBottom: 20 }}>Powered by</p>
          </Reveal>
          {/* Deliberately OUTSIDE <Reveal>: that wrapper animates `filter`, which
              creates a stacking context and would isolate mix-blend-mode from the
              section background, leaving the logo's baked-in dark box visible. */}
          {hasLogo ? (
            <img
              src="/logo_arcvion.jpg"
              alt="Arcvion"
              width={1600}
              height={508}
              className="arc-logo-img"
              loading="lazy"
              decoding="async"
              onError={() => setHasLogo(false)}
            />
          ) : (
            <div className="arc-logo-mark arc-grad">ARCVION</div>
          )}
          <Reveal>
            <p style={{ marginTop: 18, fontSize: 13, color: '#6E6C85' }}>
              Creator of <span style={{ color: '#C4B5FD', fontWeight: 600 }}>Concept Crack</span>
            </p>
          </Reveal>
        </div>

        {/* ── CTA ── */}
        <div className="arc-block" style={{ textAlign: 'center' }}>
          <Reveal>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <a
                ref={primaryCta}
                href={ARCVION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="arc-cta"
              >
                Explore Arcvion
                <span className="material-symbols-outlined arc-cta-arrow" style={{ fontSize: 18 }}>arrow_forward</span>
              </a>
              <a href={ARCVION_URL} target="_blank" rel="noopener noreferrer" className="arc-cta-ghost">
                See All Products
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
