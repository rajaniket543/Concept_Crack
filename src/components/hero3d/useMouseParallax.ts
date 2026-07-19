import { useEffect, useRef } from 'react';

export interface PointerPosition {
  x: number;
  y: number;
}

/**
 * Tracks the cursor at the window level (not via canvas pointer events) so the
 * 3D scene can react to it without ever intercepting clicks on content that
 * sits above the canvas. Returns a mutable ref for useFrame loops to read —
 * updating it never triggers a React re-render.
 */
export function useMouseParallax() {
  const pointer = useRef<PointerPosition>({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return pointer;
}
