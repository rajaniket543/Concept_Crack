import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAuthSession } from '../lib/auth';
import { categoryForPath, recordActivity, flushActivity } from '../lib/activity';

// Feature 4 — records a signed-in student's active time (per route category) so
// parents can see study engagement. Mounted once at the app root; a no-op for
// non-students and when the tab is hidden.
const TICK_MS = 15_000;   // sample active time every 15s
const FLUSH_MS = 60_000;  // persist to Firestore every 60s
const MAX_TICK_SECONDS = 30; // cap per sample (guards against sleep/background jumps)

export default function ActivityTracker() {
  const location = useLocation();

  useEffect(() => {
    const session = getAuthSession();
    if (session?.user?.role !== 'student') return;
    const uid = session.user.id;
    const pathname = location.pathname;
    let last = Date.now();

    const sample = () => {
      if (document.hidden) { last = Date.now(); return; }
      const now = Date.now();
      const secs = Math.min(MAX_TICK_SECONDS, Math.round((now - last) / 1000));
      last = now;
      recordActivity(uid, categoryForPath(pathname), secs);
    };

    const tickId = window.setInterval(sample, TICK_MS);
    const flushId = window.setInterval(() => void flushActivity(), FLUSH_MS);

    const onVisibility = () => {
      if (document.hidden) { sample(); void flushActivity(); }
      else last = Date.now();
    };
    const onUnload = () => { sample(); void flushActivity(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      sample();               // credit the time spent on this route before leaving it
      void flushActivity();
      window.clearInterval(tickId);
      window.clearInterval(flushId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [location.pathname]);

  return null;
}
