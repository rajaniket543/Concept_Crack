import HexBadge from './HexBadge';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Monthly achievement badge — earned by completing every real calendar day of
// that month's daily challenge. Renders through the shared HexBadge so it
// matches the day-milestone badges beside it.
export default function MonthBadge({ month0, year, earned, size = 52 }: { month0: number; year: number; earned: boolean; size?: number }) {
  return (
    <HexBadge
      primary={String(year)}
      secondary={MONTH_NAMES[month0].toUpperCase()}
      earned={earned}
      size={size}
      title={`${MONTH_NAMES[month0]} ${year}${earned ? ' — earned' : ''}`}
    />
  );
}
