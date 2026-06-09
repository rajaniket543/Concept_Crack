import { ExamOption as ExamOptionType } from '../../../mocks/student';

interface ExamOptionProps {
  option: ExamOptionType;
  name: string;
  selected: boolean;
  onSelect: (key: 'A' | 'B' | 'C' | 'D') => void;
}

export default function ExamOption({ option, name, selected, onSelect }: ExamOptionProps) {
  return (
    <label className="group cursor-pointer">
      <input
        className="hidden peer"
        name={name}
        type="radio"
        checked={selected}
        onChange={() => onSelect(option.key)}
      />
      <div className="flex items-center p-card border border-outline-variant rounded-xl transition-all peer-checked:border-primary peer-checked:bg-primary-fixed-dim hover:bg-surface-container hover:shadow-md">
        <span
          className={[
            'w-10 h-10 flex items-center justify-center rounded-lg border text-label-lg font-bold mr-4',
            selected
              ? 'border-primary bg-primary text-on-primary'
              : 'border-outline-variant group-hover:border-primary',
          ].join(' ')}
        >
          {option.key}
        </span>
        <span className="font-body-lg text-body-lg">{option.text}</span>
      </div>
    </label>
  );
}
