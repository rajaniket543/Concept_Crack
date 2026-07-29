import type { CSSProperties } from 'react';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoTone = 'onDark' | 'onLight' | 'theme';

interface LogoProps {
  /** Overall scale of the lockup. */
  size?: LogoSize;
  /** Text colour treatment for the background it sits on. */
  tone?: LogoTone;
  /** Show the "Concept Crack" wordmark next to the mark. */
  showText?: boolean;
  /** Show the "Every lesson, mastered." motto under the wordmark. */
  showTagline?: boolean;
  /** Ellipsize the wordmark/motto to one line (default). Set false to let
   *  them wrap instead — for spots with a tall but narrow container. */
  truncate?: boolean;
  className?: string;
  style?: CSSProperties;
}

// Pixel scale per size: mark height + wordmark / motto font sizes.
const SIZES: Record<LogoSize, { img: number; title: number; motto: number; gap: number }> = {
  sm: { img: 34, title: 15, motto: 9,    gap: 10 },
  md: { img: 42, title: 18, motto: 10.5, gap: 12 },
  lg: { img: 58, title: 25, motto: 13,   gap: 15 },
};

const TONES: Record<LogoTone, { title: string; motto: string }> = {
  onDark:  { title: '#FFFFFF',              motto: 'rgba(255,255,255,0.62)' },
  onLight: { title: '#0F0E17',              motto: 'rgba(15,14,23,0.55)' },
  theme:   { title: 'var(--text-primary)',  motto: 'var(--text-muted)' },
};

// Intrinsic aspect ratio of /logo-mark.png (495 × 320) — height drives sizing.
const MARK_RATIO = 495 / 320;

/**
 * The Concept Crack brand lockup: the emblem mark plus the "Concept Crack"
 * wordmark and "Every lesson, mastered." motto beneath it. Used everywhere the
 * brand is shown (login, landing, sidebar, headers, error pages). Purely
 * presentational — wrap it in a <Link> at the call site if it should navigate.
 * The square /logo.png is kept for the favicon only.
 */
export default function Logo({
  size = 'md',
  tone = 'theme',
  showText = true,
  showTagline = true,
  truncate = true,
  className = '',
  style,
}: LogoProps) {
  const s = SIZES[size];
  const c = TONES[tone];
  const clip = truncate ? 'truncate' : '';
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: s.gap, ...style }}>
      <img
        src="/logo-mark.png"
        alt="Concept Crack"
        width={Math.round(s.img * MARK_RATIO)}
        height={s.img}
        className="shrink-0 object-contain"
        style={{ height: s.img, width: 'auto' }}
      />
      {showText && (
        <span className="min-w-0" style={{ lineHeight: 1.1 }}>
          <span
            className={`block font-headline font-bold tracking-tight ${clip}`}
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: c.title, fontSize: s.title }}
          >
            Concept Crack
          </span>
          {showTagline && (
            <span
              className={`block ${clip}`}
              style={{
                color: c.motto,
                fontSize: s.motto,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginTop: 2,
              }}
            >
              Every lesson, mastered.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
