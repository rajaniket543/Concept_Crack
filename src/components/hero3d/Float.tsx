import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

const PERIODS = [8, 10, 12, 15, 18, 22];

/**
 * Gives any archetype independent, organic bob/spin motion derived from a
 * per-instance seed (0-1) — different period, phase and direction per
 * instance so nothing in the scene moves in lockstep.
 */
export default function Float({ seed, children }: { seed: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const period = PERIODS[Math.floor(seed * 97) % PERIODS.length];
  const phase = seed * Math.PI * 2;
  const spin = seed > 0.5 ? 1 : -1;
  const bobAmount = 0.28 + (seed % 0.3) * 0.35;

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group) return;
    const t = state.clock.elapsedTime;
    const omega = (2 * Math.PI) / period;
    group.position.y = Math.sin(t * omega + phase) * bobAmount;
    group.rotation.y += spin * 0.26 * delta;
    group.rotation.x = Math.sin(t * omega * 0.6 + phase) * 0.22;
  });

  return <group ref={ref}>{children}</group>;
}
