import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Atom, Book, Chip, DnaHelix, Flask, GlassPanel, GraduationCap, Glyph, NeuralCluster, Rocket } from './objects';

type ArchetypeKind = 'atom' | 'dna' | 'book' | 'gradcap' | 'flask' | 'neural' | 'chip' | 'rocket' | 'glass' | 'glyph';

interface RingItem {
  kind: ArchetypeKind;
  angle: number;
  scale: number;
  seed: number;
  symbol?: string;
  color?: string;
}

interface RingConfig {
  radius: number;
  y: number;
  zBias: number;
  tilt: [number, number, number];
  speed: number;
  direction: 1 | -1;
  items: RingItem[];
}

const RINGS: RingConfig[] = [
  {
    radius: 2.3,
    y: 0.3,
    zBias: 1.5,
    tilt: [0.35, 0, 0.05],
    speed: 0.15,
    direction: 1,
    items: [
      { kind: 'book', angle: 0, scale: 1.15, seed: 0.12 },
      { kind: 'rocket', angle: 2.3, scale: 1.1, seed: 0.47 },
      { kind: 'gradcap', angle: 4.4, scale: 1.1, seed: 0.81 },
    ],
  },
  {
    radius: 3.3,
    y: -0.25,
    zBias: 0.2,
    tilt: [-0.22, 0, -0.08],
    speed: 0.11,
    direction: -1,
    items: [
      { kind: 'atom', angle: 0.5, scale: 1, seed: 0.23 },
      { kind: 'dna', angle: 2.6, scale: 1, seed: 0.58 },
      { kind: 'chip', angle: 4.3, scale: 1, seed: 0.9 },
      { kind: 'neural', angle: 5.6, scale: 1, seed: 0.35 },
    ],
  },
  {
    radius: 4.4,
    y: 0.5,
    zBias: -1.2,
    tilt: [0.5, 0, 0.15],
    speed: 0.08,
    direction: 1,
    items: [
      { kind: 'flask', angle: 1.0, scale: 0.95, seed: 0.66 },
      { kind: 'glass', angle: 3.4, scale: 0.95, seed: 0.14 },
      { kind: 'glyph', angle: 5.0, scale: 0.95, seed: 0.72, symbol: '∑', color: '#8B5CF6' },
      { kind: 'glyph', angle: 0.2, scale: 0.9, seed: 0.39, symbol: 'π', color: '#06B6D4' },
    ],
  },
  {
    radius: 5.6,
    y: -0.45,
    zBias: -2.8,
    tilt: [-0.4, 0, 0.1],
    speed: 0.055,
    direction: -1,
    items: [
      { kind: 'glyph', angle: 0.8, scale: 0.85, seed: 0.51, symbol: '⚛', color: '#06B6D4' },
      { kind: 'glyph', angle: 2.9, scale: 0.85, seed: 0.27, symbol: 'Δ', color: '#8B5CF6' },
      { kind: 'glyph', angle: 4.6, scale: 0.85, seed: 0.63, symbol: '∞', color: '#C4B5FD' },
      { kind: 'neural', angle: 5.9, scale: 0.85, seed: 0.08 },
    ],
  },
];

function renderItem(item: RingItem, fancyMaterials: boolean) {
  switch (item.kind) {
    case 'atom': return <Atom seed={item.seed} scale={item.scale} />;
    case 'dna': return <DnaHelix seed={item.seed} scale={item.scale} />;
    case 'book': return <Book seed={item.seed} scale={item.scale} />;
    case 'gradcap': return <GraduationCap seed={item.seed} scale={item.scale} />;
    case 'flask': return <Flask seed={item.seed} scale={item.scale} fancyMaterials={fancyMaterials} />;
    case 'neural': return <NeuralCluster seed={item.seed} scale={item.scale} />;
    case 'chip': return <Chip seed={item.seed} scale={item.scale} />;
    case 'rocket': return <Rocket seed={item.seed} scale={item.scale} />;
    case 'glass': return <GlassPanel seed={item.seed} scale={item.scale} fancyMaterials={fancyMaterials} />;
    case 'glyph': return <Glyph seed={item.seed} scale={item.scale} symbol={item.symbol!} color={item.color} />;
  }
}

function Ring({ config, fancyMaterials, fraction }: { config: RingConfig; fancyMaterials: boolean; fraction: number }) {
  const ref = useRef<Group>(null);
  const visibleItems = useMemo(() => {
    const n = Math.max(1, Math.round(config.items.length * fraction));
    return config.items.slice(0, n);
  }, [config, fraction]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += config.speed * config.direction * delta;
  });

  return (
    <group position={[0, config.y, config.zBias]} rotation={config.tilt}>
      <group ref={ref}>
        {visibleItems.map((item, i) => (
          <group key={i} position={[Math.cos(item.angle) * config.radius, 0, Math.sin(item.angle) * config.radius]}>
            {renderItem(item, fancyMaterials)}
          </group>
        ))}
      </group>
    </group>
  );
}

interface OrbitSystemProps {
  fancyMaterials: boolean;
  fraction: number;
}

/** Orbit rings of curated archetypes circling the AI core, each at its own radius/speed/direction/tilt so nothing intersects. */
export default function OrbitSystem({ fancyMaterials, fraction }: OrbitSystemProps) {
  return (
    <group position={[0, 0, -2.5]}>
      {RINGS.map((ring, i) => (
        <Ring key={i} config={ring} fancyMaterials={fancyMaterials} fraction={fraction} />
      ))}
    </group>
  );
}
