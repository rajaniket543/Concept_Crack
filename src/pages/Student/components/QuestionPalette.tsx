export type PaletteState = 'answered' | 'marked' | 'not-visited';

interface QuestionPaletteProps {
  total: number;
  /** Map of questionId -> state. */
  state: Record<number, PaletteState>;
  current: number;
  onSelect: (id: number) => void;
}

const STATE_CLASS: Record<PaletteState, string> = {
  answered: 'bg-primary text-on-primary',
  marked: 'bg-secondary text-on-secondary',
  'not-visited': 'bg-surface-container-highest text-on-surface-variant border border-outline-variant',
};

export default function QuestionPalette({ total, state, current, onSelect }: QuestionPaletteProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((id) => {
        const st = state[id] ?? 'not-visited';
        const isCurrent = id === current;
        const baseClass = STATE_CLASS[st];
        const currentClass = isCurrent
          ? 'border-2 border-primary bg-white text-primary font-black'
          : 'font-bold';
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-label-md ${baseClass} ${currentClass}`}
          >
            {id}
          </button>
        );
      })}
    </div>
  );
}
