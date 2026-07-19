import * as THREE from 'three';

let glowTexture: THREE.Texture | null = null;
let gridTexture: THREE.Texture | null = null;
const glyphTextures = new Map<string, THREE.Texture>();

/** Soft radial-gradient sprite used to fake bloom/glow without a postprocessing pass. */
export function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(180,160,255,0.55)');
  gradient.addColorStop(1, 'rgba(91,79,232,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.needsUpdate = true;
  return glowTexture;
}

/** Faint emissive circuit-grid pattern used on the "chip" archetype. */
export function getGridTexture(): THREE.Texture {
  if (gridTexture) return gridTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0c0b18';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(139,92,246,0.9)';
  ctx.lineWidth = 2;
  for (let i = 16; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  gridTexture = new THREE.CanvasTexture(canvas);
  gridTexture.needsUpdate = true;
  return gridTexture;
}

/**
 * Renders a math/physics glyph to a canvas sprite texture using system fonts
 * (no network font fetch — keeps the scene fully self-contained/offline-safe).
 */
export function getGlyphTexture(symbol: string, color: string): THREE.Texture {
  const key = `${symbol}|${color}`;
  const cached = glyphTextures.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 160px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(symbol, size / 2, size / 2 + 8);
  ctx.fillText(symbol, size / 2, size / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  glyphTextures.set(key, texture);
  return texture;
}
