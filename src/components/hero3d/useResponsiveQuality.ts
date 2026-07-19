import { useEffect, useState } from 'react';

export type QualityTier = 'mobile' | 'tablet' | 'desktop';

export interface QualitySettings {
  tier: QualityTier;
  /** Point count for the background particle field. */
  particleCount: number;
  /** Fraction (0-1) of the full curated object set to render. */
  archetypeFraction: number;
  /** DPR range passed straight to <Canvas dpr>. */
  dpr: [number, number];
  /** Whether to use transmission/distort materials (expensive on low-end GPUs). */
  fancyMaterials: boolean;
  /** Whether to render the faked-bloom glow sprites. */
  glow: boolean;
  reducedMotion: boolean;
  webglAvailable: boolean;
}

const TIER_SETTINGS: Record<QualityTier, Omit<QualitySettings, 'tier' | 'reducedMotion' | 'webglAvailable'>> = {
  desktop: { particleCount: 2200, archetypeFraction: 1, dpr: [1, 2], fancyMaterials: true, glow: true },
  tablet: { particleCount: 900, archetypeFraction: 0.6, dpr: [1, 1.5], fancyMaterials: true, glow: true },
  mobile: { particleCount: 450, archetypeFraction: 0.2, dpr: [1, 1], fancyMaterials: false, glow: false },
};

function getTier(width: number): QualityTier {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function checkWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function useResponsiveQuality(): QualitySettings {
  const [tier, setTier] = useState<QualityTier>(() => getTier(window.innerWidth));
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [webglAvailable] = useState(checkWebgl);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTier(getTier(window.innerWidth)));
    };
    window.addEventListener('resize', onResize);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return { tier, reducedMotion, webglAvailable, ...TIER_SETTINGS[tier] };
}
