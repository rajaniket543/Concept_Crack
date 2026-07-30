// The one hexagonal achievement badge shape used everywhere — monthly
// challenge badges and day-milestone badges both render through this, so a
// badge always looks the same wherever it appears (dashboard calendar,
// achievements row, profile page).

export default function HexBadge({
  primary,
  secondary,
  earned,
  size = 52,
  title,
}: {
  /** Large centred text, e.g. a year or a day count. */
  primary: string;
  /** Small text beneath it, e.g. 'MAR' or 'DAYS'. */
  secondary?: string;
  earned: boolean;
  size?: number;
  title?: string;
}) {
  const h = size * (58 / 52);
  const fill = earned ? 'var(--brand)' : 'var(--surface-muted)';
  const stroke = earned ? 'var(--brand-hover)' : 'var(--border)';
  const primaryFill = earned ? '#fff' : 'var(--text-faint)';
  const secondaryFill = earned ? 'rgba(255,255,255,0.85)' : 'var(--text-faint)';
  // Long numbers (e.g. "365") need to shrink to stay inside the hexagon.
  const primarySize = primary.length >= 4 ? 11 : primary.length === 3 ? 13 : 14;

  return (
    <svg width={size} height={h} viewBox="0 0 52 58" style={{ opacity: earned ? 1 : 0.75 }}>
      {title && <title>{title}</title>}
      <polygon
        points="26,2 48,15 48,43 26,56 4,43 4,15"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      <text
        x="26" y={secondary ? 30 : 34} textAnchor="middle"
        fontSize={primarySize} fontWeight="700" fill={primaryFill}
      >
        {primary}
      </text>
      {secondary && (
        <text x="26" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill={secondaryFill}>
          {secondary}
        </text>
      )}
    </svg>
  );
}
