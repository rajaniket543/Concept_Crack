import { useEffect, type RefObject } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Subtle magnetic pull toward the cursor; the element's own CSS transition springs it back on mouseleave. */
export function useMagneticHover(ref: RefObject<HTMLElement | null>, strength = 10) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const relY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      el.style.setProperty('--mx', `${relX * strength}px`);
      el.style.setProperty('--my', `${relY * strength * 0.6}px`);
    };
    const onLeave = () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref, strength]);
}

/** Injects a short-lived expanding ripple span at the click point; cleans itself up. */
export function spawnRipple(e: ReactMouseEvent<HTMLElement>) {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = 'bh-ripple';
  span.style.left = `${e.clientX - rect.left}px`;
  span.style.top = `${e.clientY - rect.top}px`;
  el.appendChild(span);
  span.addEventListener('animationend', () => span.remove());
}

/** Tracks the cursor within `ref` and exposes it as CSS custom properties for a background glow to follow. */
export function useCursorGlow(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty('--cc-cursor-x', `${x}%`);
        el.style.setProperty('--cc-cursor-y', `${y}%`);
      });
    };

    el.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', onMove);
    };
  }, [ref]);
}
