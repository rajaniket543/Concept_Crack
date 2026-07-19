import { useEffect, useRef, type RefObject } from 'react';

/**
 * 0-1 progress of how far the user has scrolled through `sectionRef`'s own
 * height. Returned as a ref (not state) so consumers — a useFrame loop, a
 * CSS variable write — can read it without forcing React re-renders on
 * every scroll tick.
 */
export function useScrollProgress(sectionRef: RefObject<HTMLElement | null>) {
  const progress = useRef(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const height = sectionRef.current?.offsetHeight ?? window.innerHeight;
        const value = Math.min(1, Math.max(0, window.scrollY / height));
        progress.current = value;
        sectionRef.current?.style.setProperty('--cc-scroll', value.toString());
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sectionRef]);

  return progress;
}
