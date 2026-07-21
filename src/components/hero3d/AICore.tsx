import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { Mesh, Sprite, SpriteMaterial } from 'three';
import { getGlowTexture } from './textures';

interface AICoreProps {
  fancyMaterials: boolean;
  glow: boolean;
}

/** The glowing intelligence at the center of the scene, behind the heading. */
export default function AICore({ fancyMaterials, glow }: AICoreProps) {
  const coreRef = useRef<Mesh>(null);
  const ring1 = useRef<Mesh>(null);
  const ring2 = useRef<Mesh>(null);
  const ring3 = useRef<Mesh>(null);
  const glowRef = useRef<Sprite & { material: SpriteMaterial }>(null);
  const glowTexture = useMemo(() => (glow ? getGlowTexture() : null), [glow]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.22;
      coreRef.current.rotation.x = Math.sin(t * 0.16) * 0.2;
      const breathe = 1 + Math.sin(t * 0.75) * 0.07;
      coreRef.current.scale.setScalar(breathe);
    }
    if (ring1.current) ring1.current.rotation.z = t * 0.3;
    if (ring2.current) ring2.current.rotation.x = t * -0.22;
    if (ring3.current) ring3.current.rotation.y = t * 0.18;
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.45 + Math.sin(t * 0.75) * 0.12;
    }
  });

  return (
    <group position={[0, 0, -2.5]}>
      {glowTexture && (
        <sprite ref={glowRef} scale={[7, 7, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.55}
            color="#5B4FE8"
          />
        </sprite>
      )}

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.15, fancyMaterials ? 4 : 1]} />
        {fancyMaterials ? (
          <MeshDistortMaterial
            color="#5B4FE8"
            emissive="#7C3AED"
            emissiveIntensity={0.6}
            roughness={0.15}
            metalness={0.6}
            distort={0.28}
            speed={1.4}
          />
        ) : (
          <meshStandardMaterial color="#5B4FE8" emissive="#5B4FE8" emissiveIntensity={0.5} roughness={0.3} metalness={0.4} />
        )}
      </mesh>

      <mesh ref={ring1} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.7, 0.012, 8, 96]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 3, Math.PI / 5, 0]}>
        <torusGeometry args={[2.1, 0.01, 8, 96]} />
        <meshBasicMaterial color="#06B6D4" transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring3} rotation={[0, 0, Math.PI / 6]}>
        <torusGeometry args={[1.4, 0.008, 8, 96]} />
        <meshBasicMaterial color="#C4B5FD" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
