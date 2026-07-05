/**
 * A pure-CSS circular spinner (no icon font, no text). Using the Material
 * Symbols "progress_activity" icon for loading meant that, before the icon
 * font finished loading, the literal ligature text "progress_activity" would
 * appear and spin. This has no such failure mode.
 *
 * The ring uses `currentColor`, so it matches surrounding text unless a
 * `color` is supplied.
 */
export default function Spinner({
  size = 16,
  color,
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
      style={{ width: size, height: size, color, verticalAlign: 'middle' }}
      aria-hidden="true"
    />
  );
}
