import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { pathFor } from '../lib/pages';
import './BookHero.css';

const heroParticles = Array.from({ length: 26 }, (_, i) => {
  const frac = (x: number) => x - Math.floor(x);
  return {
    left: frac(i * 0.61803) * 96 + 2,
    size: 2 + Math.round(frac(i * 0.31) * 3),
    dur: 12 + frac(i * 0.53) * 14,
    delay: -frac(i * 0.87) * 24,
    drift: (frac(i * 0.29) - 0.5) * 60,
    color: ['#5B4FE8', '#8B5CF6', '#06B6D4', '#C4B5FD'][i % 4],
  };
});

export default function BookHero() {
  return (
    <section className="book-hero" aria-label="Concept Crack AI-powered learning hero">
      <div className="bh-bg" aria-hidden="true">
        <div className="bh-aurora" />
        <div className="bh-grid" />
        <div className="bh-orb bh-orb-a" />
        <div className="bh-orb bh-orb-b" />
        <div className="bh-orb bh-orb-c" />
        <div className="bh-vignette" />
        {heroParticles.map((p, i) => (
          <span
            key={i}
            className="bh-particle"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              boxShadow: `0 0 6px ${p.color}`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              '--cc-drift': `${p.drift}px`,
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="bh-content">
        <div className="bh-badge">
          <span className="material-symbols-outlined filled" style={{ fontSize: '14px' }}>auto_awesome</span>
          Powered by Generative AI
        </div>

        <h1 className="bh-title">
          Crack Any Exam with
          <br />
          <span className="bh-grad">AI-Powered Intelligence</span>
        </h1>

        <p className="bh-subtitle">
          Concept Crack adapts to your unique learning style, identifies knowledge gaps in real-time,
          and creates a personalized path to your dream rank - built for JEE and NEET aspirants.
        </p>

        <div className="bh-actions">
          <Link
            to={pathFor('login')}
            className="bh-cta-primary"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>rocket_launch</span>
            Start Preparing Free
          </Link>
          <Link
            to={pathFor('login')}
            className="bh-cta-ghost"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_circle</span>
            Watch Demo
          </Link>
        </div>

        <div className="bh-filters">
          <span>JEE Main + Advanced</span>
          <span>NEET UG</span>
        </div>
      </div>
    </section>
  );
}
