import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import Float from './Float';
import { getGlyphTexture, getGridTexture } from './textures';

/**
 * Curated procedural archetypes for the hero's "knowledge universe" — built
 * entirely from primitives + math (no imported 3D model assets), each wrapped
 * in <Float> for independent per-instance motion. Kept to ~10 archetypes,
 * each instanced a handful of times by OrbitSystem, rather than the full
 * literal object list — see the plan for the reasoning.
 */

export function Atom({ seed, scale = 1 }: { seed: number; scale?: number }) {
  const ring1 = useRef<Group>(null);
  const ring2 = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring1.current) ring1.current.rotation.z = t * 0.6 + seed * 6;
    if (ring2.current) ring2.current.rotation.x = t * -0.45 + seed * 6;
  });

  return (
    <Float seed={seed}>
      <group scale={scale}>
        <mesh>
          <icosahedronGeometry args={[0.16, 1]} />
          <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={0.7} roughness={0.3} metalness={0.5} />
        </mesh>
        <group ref={ring1} rotation={[Math.PI / 2.2, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.42, 0.006, 6, 48]} />
            <meshBasicMaterial color="#8B5CF6" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0.42, 0, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#C4B5FD" emissive="#C4B5FD" emissiveIntensity={1} />
          </mesh>
        </group>
        <group ref={ring2} rotation={[0, Math.PI / 2.6, Math.PI / 5]}>
          <mesh>
            <torusGeometry args={[0.42, 0.006, 6, 48]} />
            <meshBasicMaterial color="#06B6D4" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0.42, 0, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#67E8F9" emissive="#67E8F9" emissiveIntensity={1} />
          </mesh>
        </group>
      </group>
    </Float>
  );
}

export function DnaHelix({ seed, scale = 1 }: { seed: number; scale?: number }) {
  const { strandA, strandB, rungs } = useMemo(() => {
    const turns = 3;
    const pointsPerTurn = 6;
    const count = turns * pointsPerTurn;
    const height = 0.9;
    const radius = 0.14;
    const a: [number, number, number][] = [];
    const b: [number, number, number][] = [];
    const r: { y: number; angle: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const frac = i / count;
      const angle = frac * turns * Math.PI * 2;
      const y = (frac - 0.5) * height;
      a.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
      b.push([Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius]);
      if (i % 2 === 0) r.push({ y, angle });
    }
    return { strandA: a, strandB: b, rungs: r };
  }, []);

  return (
    <Float seed={seed}>
      <group scale={scale}>
        {strandA.map((p, i) => (
          <mesh key={`a${i}`} position={p}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#5B4FE8" emissive="#5B4FE8" emissiveIntensity={0.6} roughness={0.4} />
          </mesh>
        ))}
        {strandB.map((p, i) => (
          <mesh key={`b${i}`} position={p}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={0.6} roughness={0.4} />
          </mesh>
        ))}
        {rungs.map((r, i) => (
          <mesh key={`r${i}`} position={[0, r.y, 0]} rotation={[0, r.angle, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.28, 6]} />
            <meshBasicMaterial color="#C4B5FD" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

export function Book({ seed, scale = 1 }: { seed: number; scale?: number }) {
  return (
    <Float seed={seed}>
      <group scale={scale} rotation={[0.15, 0.4, 0.05]}>
        <mesh>
          <boxGeometry args={[0.5, 0.62, 0.08]} />
          <meshStandardMaterial color="#5B4FE8" roughness={0.35} metalness={0.25} emissive="#5B4FE8" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <boxGeometry args={[0.46, 0.58, 0.02]} />
          <meshStandardMaterial color="#F4F1FF" roughness={0.6} />
        </mesh>
      </group>
    </Float>
  );
}

export function GraduationCap({ seed, scale = 1 }: { seed: number; scale?: number }) {
  return (
    <Float seed={seed}>
      <group scale={scale} rotation={[0.1, seed * Math.PI * 2, 0]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.62, 0.04, 0.62]} />
          <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.16, 8]} />
          <meshStandardMaterial color="#1E1D2E" roughness={0.5} />
        </mesh>
        <mesh position={[0.28, -0.02, 0.28]}>
          <cylinderGeometry args={[0.006, 0.006, 0.22, 6]} />
          <meshBasicMaterial color="#F5D67A" />
        </mesh>
        <mesh position={[0.28, -0.14, 0.28]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#F5D67A" emissive="#F5D67A" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </Float>
  );
}

export function Flask({ seed, scale = 1, fancyMaterials }: { seed: number; scale?: number; fancyMaterials: boolean }) {
  return (
    <Float seed={seed}>
      <group scale={scale}>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.26, 0.4, 16]} />
          {fancyMaterials ? (
            <MeshTransmissionMaterial color="#06B6D4" thickness={0.3} roughness={0.05} transmission={1} ior={1.3} chromaticAberration={0.02} />
          ) : (
            <meshStandardMaterial color="#06B6D4" transparent opacity={0.35} roughness={0.1} />
          )}
        </mesh>
        <mesh position={[0, -0.28, 0]}>
          <sphereGeometry args={[0.09, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.6} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.24, 12]} />
          <meshStandardMaterial color="#E5E7EB" transparent opacity={0.25} roughness={0.05} />
        </mesh>
      </group>
    </Float>
  );
}

export function NeuralCluster({ seed, scale = 1 }: { seed: number; scale?: number }) {
  const nodes = useMemo(() => {
    const list: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const frac = (i * 0.61803 + seed) % 1;
      const angle = frac * Math.PI * 2;
      const r = 0.18 + (i % 3) * 0.06;
      list.push([Math.cos(angle) * r, Math.sin(angle * 1.7) * 0.18, Math.sin(angle) * r]);
    }
    return list;
  }, [seed]);

  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const b = nodes[(i + 1) % nodes.length];
      positions.push(...a, ...b);
      if (i % 2 === 0) {
        const c = nodes[(i + 3) % nodes.length];
        positions.push(...a, ...c);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, [nodes]);

  return (
    <Float seed={seed}>
      <group scale={scale}>
        {nodes.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color="#7C3AED" emissive="#7C3AED" emissiveIntensity={0.8} />
          </mesh>
        ))}
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial color="#8B5CF6" transparent opacity={0.35} />
        </lineSegments>
      </group>
    </Float>
  );
}

export function Chip({ seed, scale = 1 }: { seed: number; scale?: number }) {
  const gridTexture = useMemo(() => getGridTexture(), []);
  const pins = useMemo(() => Array.from({ length: 6 }, (_, i) => (i - 2.5) * 0.09), []);

  return (
    <Float seed={seed}>
      <group scale={scale} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.04]} />
          <meshStandardMaterial color="#151426" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[0.44, 0.44]} />
          <meshStandardMaterial map={gridTexture} emissive="#8B5CF6" emissiveIntensity={0.4} roughness={0.4} />
        </mesh>
        {pins.map((x, i) => (
          <mesh key={i} position={[x, -0.29, 0]}>
            <boxGeometry args={[0.03, 0.08, 0.03]} />
            <meshStandardMaterial color="#F5D67A" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

export function Rocket({ seed, scale = 1 }: { seed: number; scale?: number }) {
  const fins = [0, 1, 2];
  return (
    <Float seed={seed}>
      <group scale={scale} rotation={[0, seed * Math.PI * 2, 0]}>
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.12, 0.26, 12]} />
          <meshStandardMaterial color="#EF4444" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.42, 12]} />
          <meshStandardMaterial color="#E5E7EB" roughness={0.25} metalness={0.5} />
        </mesh>
        {fins.map((i) => {
          const a = (i / fins.length) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.13, -0.18, Math.sin(a) * 0.13]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.02, 0.14, 0.09]} />
              <meshStandardMaterial color="#5B4FE8" roughness={0.4} />
            </mesh>
          );
        })}
        <mesh position={[0, -0.22, 0]}>
          <coneGeometry args={[0.08, 0.14, 12]} />
          <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={0.8} transparent opacity={0.7} />
        </mesh>
      </group>
    </Float>
  );
}

export function GlassPanel({ seed, scale = 1, fancyMaterials }: { seed: number; scale?: number; fancyMaterials: boolean }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.62, 0.42)), []);
  return (
    <Float seed={seed}>
      <group scale={scale} rotation={[0.2, seed * Math.PI * 2, 0.05]}>
        <mesh>
          <planeGeometry args={[0.62, 0.42]} />
          {fancyMaterials ? (
            <MeshTransmissionMaterial color="#C4B5FD" thickness={0.05} roughness={0.15} transmission={0.9} ior={1.2} />
          ) : (
            <meshStandardMaterial color="#C4B5FD" transparent opacity={0.12} roughness={0.2} />
          )}
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#C4B5FD" transparent opacity={0.5} />
        </lineSegments>
      </group>
    </Float>
  );
}

export function Glyph({ seed, scale = 1, symbol, color = '#8B5CF6' }: { seed: number; scale?: number; symbol: string; color?: string }) {
  const texture = useMemo(() => getGlyphTexture(symbol, color), [symbol, color]);
  return (
    <Float seed={seed}>
      <sprite scale={[scale * 0.55, scale * 0.55, 1]}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
    </Float>
  );
}
