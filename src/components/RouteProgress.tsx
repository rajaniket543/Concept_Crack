import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A thin, brand-coloured progress bar that animates across the top of the
 * viewport on every route change. Gives consistent, professional loading
 * feedback site-wide without touching individual pages.
 */
export default function RouteProgress() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(true);
    setProgress(12);
    const t1 = window.setTimeout(() => setProgress(72), 90);
    const t2 = window.setTimeout(() => setProgress(100), 380);
    const t3 = window.setTimeout(() => setVisible(false), 620);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [location.pathname]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 200,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #5B4FE8, #8B5CF6, #06B6D4)',
          boxShadow: '0 0 8px rgba(91,79,232,0.6)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
