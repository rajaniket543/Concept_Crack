const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Hexagonal monthly achievement badge — filled brand color when earned
// (completed every real calendar day of that month), a muted outline
// otherwise. Reused on the Dashboard's daily-challenge calendar and on the
// profile page's achievement gallery so both stay visually identical.
export default function MonthBadge({ month0, year, earned, size = 52 }: { month0: number; year: number; earned: boolean; size?: number }) {
  const h = size * (58 / 52);
  return (
    <svg width={size} height={h} viewBox="0 0 52 58">
      <title>{`${MONTH_NAMES[month0]} ${year}${earned ? ' — earned' : ''}`}</title>
      <polygon
        points="26,2 48,15 48,43 26,56 4,43 4,15"
        fill={earned ? 'var(--brand)' : 'var(--surface-muted)'}
        stroke={earned ? 'var(--brand-hover)' : 'var(--border)'}
        strokeWidth="2"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="14" fontWeight="700" fill={earned ? '#fff' : 'var(--text-faint)'}>
        {year}
      </text>
      <text x="26" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill={earned ? 'rgba(255,255,255,0.85)' : 'var(--text-faint)'}>
        {MONTH_NAMES[month0].toUpperCase()}
      </text>
    </svg>
  );
}
