interface HeatmapCellProps {
  cellClass: string;
  tooltip: string;
  size?: 'default' | 'sm';
}

export default function HeatmapCell({ cellClass, tooltip, size = 'default' }: HeatmapCellProps) {
  const sizeClass = size === 'sm' ? 'min-h-[24px]' : 'min-h-[40px]';
  return (
    <div
      className={`${sizeClass} aspect-square rounded transition-all duration-200 ease-in-out cursor-help relative group hover:scale-110 hover:z-10 hover:shadow-elev-2 ${cellClass}`}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-inverse-surface text-inverse-on-surface text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
        {tooltip}
      </div>
    </div>
  );
}
