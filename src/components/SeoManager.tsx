import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applySeo } from '../lib/seo';

/**
 * Keeps <title>, meta description, canonical and the social tags in sync with
 * the active route. Mounted once inside the Router; renders nothing.
 *
 * Without this, the SPA serves every route the same static index.html — so all
 * pages reported the homepage's canonical URL, which tells Google they are
 * duplicates of `/` and blocks them from being indexed on their own.
 */
export default function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applySeo(pathname);
  }, [pathname]);

  return null;
}
