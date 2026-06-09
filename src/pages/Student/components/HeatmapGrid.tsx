import HeatmapCell from './HeatmapCell';

interface HeatmapCellData {
  cellClass: string;
  tooltip: string;
}

interface HeatmapGridProps {
  cells: HeatmapCellData[];
  cols: number;
  gapClass?: string;
  cellSize?: 'default' | 'sm';
}

export default function HeatmapGrid({
  cells,
  cols,
  gapClass = 'gap-2',
  cellSize = 'default',
}: HeatmapGridProps) {
  return (
    <div
      className={`grid overflow-x-auto pb-4 ${gapClass}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cells.map((c, i) => (
        <HeatmapCell
          key={i}
          cellClass={c.cellClass}
          tooltip={c.tooltip}
          size={cellSize}
        />
      ))}
    </div>
  );
}
