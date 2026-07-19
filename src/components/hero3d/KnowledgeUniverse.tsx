import { Suspense, useEffect, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import AICore from './AICore';
import OrbitSystem from './OrbitSystem';
import ParticleField from './ParticleField';
import { useMouseParallax } from './useMouseParallax';
import type { QualitySettings } from './useResponsiveQuality';

interface SceneProps {
  quality: QualitySettings;
  scrollProgress: MutableRefObject<number>;
}

function Scene({ quality, scrollProgress }: SceneProps) {
  const pointer = useMouseParallax();
  const { camera, scene } = useThree();
  const driftGroup = useRef<Group>(null);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#0f0e17', 0.05);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Autonomous slow drift + a subtle mouse parallax on top — both clamped
    // small so the motion never feels dramatic or distracting.
    const targetX = pointer.current.x * 0.4 + Math.sin(t * 0.05) * 0.15;
    const targetY = -pointer.current.y * 0.25 + Math.cos(t * 0.04) * 0.1;
    camera.position.x += (targetX - camera.position.x) * 0.03;
    camera.position.y += (targetY - camera.position.y) * 0.03;
    camera.lookAt(0, 0, -2.5);

    if (driftGroup.current) {
      driftGroup.current.position.y = scrollProgress.current * 2.2;
      driftGroup.current.rotation.y = scrollProgress.current * 0.15;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 5]} intensity={0.8} color="#C4B5FD" />
      <directionalLight position={[-5, -3, -4]} intensity={0.3} color="#06B6D4" />
      <group ref={driftGroup}>
        <AICore fancyMaterials={quality.fancyMaterials} glow={quality.glow} />
        <OrbitSystem fancyMaterials={quality.fancyMaterials} fraction={quality.archetypeFraction} />
        <ParticleField count={quality.particleCount} />
      </group>
    </>
  );
}

interface KnowledgeUniverseProps {
  quality: QualitySettings;
  scrollProgress: MutableRefObject<number>;
}

/** Canvas root for the hero's cinematic 3D background. Lazy-loaded from BookHero. */
export default function KnowledgeUniverse({ quality, scrollProgress }: KnowledgeUniverseProps) {
  return (
    <Canvas
      dpr={quality.dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 5.5], fov: 50 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Suspense fallback={null}>
        <Scene quality={quality} scrollProgress={scrollProgress} />
      </Suspense>
    </Canvas>
  );
}
