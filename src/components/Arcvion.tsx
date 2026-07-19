import type { CSSProperties } from 'react';
import './Arcvion.css';

export const ARCVION_URL = 'https://arcvion.in';

/**
 * Arcvion brand mark — an interlocking "A" chevron drawn inline so it needs no
 * asset file and inherits currentColor. Swap this for an <img> if a real logo
 * file is added to /public.
 */
export function ArcvionMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="arcvion-mark"
    >
      <path d="M12 2.5 3 20h4.2l2-4.1h5.6l2 4.1H21L12 2.5Zm0 6.6 1.9 3.9h-3.8L12 9.1Z" fill="currentColor" />
      <circle cx="12" cy="20.4" r="1.6" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/** The "Arcvion" wordmark with the hover glow + underline sweep. */
export function ArcvionLink({
  className = '',
  showMark = true,
  style,
}: {
  className?: string;
  showMark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <a
      href={ARCVION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`arcvion-link ${className}`}
      style={style}
      aria-label="Arcvion — opens in a new tab"
    >
      {showMark && <ArcvionMark />}
      <span className="arcvion-word">Arcvion</span>
    </a>
  );
}

/**
 * Compact "Powered by Arcvion" badge for app surfaces (login, sidebar, exam
 * header). Deliberately low-contrast so it never competes with the product UI.
 */
export function ArcvionBadge({
  variant = 'default',
  className = '',
}: {
  /** 'compact' drops the tagline — for tight spots like the exam header. */
  variant?: 'default' | 'compact' | 'onDark';
  className?: string;
}) {
  return (
    <a
      href={ARCVION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`arcvion-badge arcvion-badge-${variant} ${className}`}
      aria-label="Powered by Arcvion — opens in a new tab"
    >
      <span className="arcvion-badge-mark">
        <ArcvionMark size={variant === 'compact' ? 14 : 16} />
      </span>
      <span className="arcvion-badge-text">
        <span className="arcvion-badge-kicker">Powered by</span>
        <span className="arcvion-badge-name">Arcvion</span>
        {variant !== 'compact' && (
          <span className="arcvion-badge-tagline">AI • Technology • Innovation</span>
        )}
      </span>
    </a>
  );
}
