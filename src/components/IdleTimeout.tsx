import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession, getLastActivity, markActivity, logout } from '../lib/auth';

// Signed-in users are automatically logged out after this much inactivity.
const IDLE_LIMIT_MS = 5 * 60 * 60 * 1000; // 5 hours
// How often we re-check whether the idle limit has been crossed.
const CHECK_MS = 60_000; // 1 minute
// Don't write to localStorage on every mouse move — one write per window is enough.
const THROTTLE_MS = 30_000; // 30 seconds

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];

/**
 * Mounted once at the app root. Watches for user activity and force-logs-out a
 * signed-in user who has been idle for longer than IDLE_LIMIT_MS. Uses a
 * timestamp in localStorage so the rule survives page reloads and closed tabs,
 * and applies to every role. A no-op while logged out.
 */
export default function IdleTimeout() {
  const navigate = useNavigate();

  useEffect(() => {
    let lastMark = 0;
    let loggingOut = false;

    // Seed the clock if we're signed in but have no timestamp yet (e.g. a
    // session created before this feature existed).
    if (getAuthSession() && !getLastActivity()) markActivity();

    const bump = () => {
      const now = Date.now();
      if (now - lastMark < THROTTLE_MS) return;
      lastMark = now;
      if (getAuthSession()) markActivity();
    };

    const check = async () => {
      if (loggingOut) return;
      if (!getAuthSession()) return;
      const last = getLastActivity();
      if (last && Date.now() - last > IDLE_LIMIT_MS) {
        loggingOut = true;
        // clearAuthSession() runs first inside logout(), so the local session is
        // gone even if Firebase signOut rejects — redirect either way.
        try { await logout(); } finally { navigate('/login', { replace: true }); }
      }
    };

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const onVisibility = () => { if (!document.hidden) void check(); };
    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(() => void check(), CHECK_MS);

    // Also check immediately on load — catches a tab reopened after the limit.
    void check();

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, bump));
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [navigate]);

  return null;
}
