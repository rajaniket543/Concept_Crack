import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { pathFor } from '../lib/pages';
import { useMagneticHover, spawnRipple } from './heroInteractions';
import './BookHero.css';

export default function BookHero({ isDark }: { isDark: boolean }) {
  const primaryCtaRef = useRef<HTMLAnchorElement>(null);
  const ghostCtaRef = useRef<HTMLAnchorElement>(null);

  useMagneticHover(primaryCtaRef);
  useMagneticHover(ghostCtaRef);

  return (
    <section
      className={`book-hero ${isDark ? 'book-hero--dark' : 'book-hero--light'}`}
      aria-label="Concept Crack AI-powered learning hero"
    >
      {/* Static background — no animation */}
      <div className="bh-bg" aria-hidden="true">
        <div className="bh-vignette" />
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
            ref={primaryCtaRef}
            onClick={spawnRipple}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>rocket_launch</span>
            Start Preparing Free
          </Link>
          <Link
            to={pathFor('login')}
            className="bh-cta-ghost"
            ref={ghostCtaRef}
            onClick={spawnRipple}
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
