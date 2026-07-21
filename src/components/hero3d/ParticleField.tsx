import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Points as ThreePoints } from 'three';

const PALETTE = [
  new THREE.Color('#5B4FE8'),
  new THREE.Color('#8B5CF6'),
  new THREE.Color('#06B6D4'),
  new THREE.Color('#FFFFFF'),
];

interface ParticleFieldProps {
  count: number;
}

/**
 * One draw call worth of glowing background particles (stars / galaxy dust),
 * plus a handful of static "constellation" lines with a light pulse
 * traveling along a few of them. Cost stays flat regardless of `count`
 * (a single Points mesh), so raising density on desktop is free.
 */
export default function ParticleField({ count }: ParticleFieldProps) {
  const pointsRef = useRef<ThreePoints>(null);
  const groupRef = useRef<Group>(null);
  const pulseRefs = useRef<(THREE.Mesh | null)[]>([]);

  const { geometry, anchors, lines } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const anchorPoints: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 16;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 12 - 2;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const color = PALETTE[i % PALETTE.length];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      if (i % Math.max(1, Math.floor(count / 26)) === 0) {
        anchorPoints.push(new THREE.Vector3(x, y, z));
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Connect consecutive anchors that land within a reasonable distance —
    // a cheap O(n) constellation instead of an O(n^2) nearest-neighbor scan.
    const linePairs: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < anchorPoints.length - 1; i++) {
      const a = anchorPoints[i];
      const b = anchorPoints[i + 1];
      if (a.distanceTo(b) < 6) linePairs.push([a, b]);
    }

    const linePositions: number[] = [];
    linePairs.forEach(([a, b]) => linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z));
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    return { geometry: geom, anchors: anchorPoints, lines: { geometry: lineGeom, pairs: linePairs.slice(0, 5) } };
  }, [count]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
    const t = state.clock.elapsedTime;
    lines.pairs.forEach(([a, b], i) => {
      const dot = pulseRefs.current[i];
      if (!dot) return;
      const progress = (t * 0.55 + i * 0.3) % 1;
      dot.position.lerpVectors(a, b, progress);
      const fade = Math.sin(progress * Math.PI);
      (dot.material as THREE.MeshBasicMaterial).opacity = fade;
    });
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          size={0.05}
          vertexColors
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {anchors.length > 1 && (
        <lineSegments geometry={lines.geometry}>
          <lineBasicMaterial color="#8B5CF6" transparent opacity={0.18} blending={THREE.AdditiveBlending} />
        </lineSegments>
      )}

      {lines.pairs.map((_, i) => (
        <mesh key={i} ref={(el) => { pulseRefs.current[i] = el; }}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}
