import { Link } from 'react-router-dom';
import { SubjectStat } from '../../../mocks/student';
import ProgressBar from './ProgressBar';
import { pathFor } from '../../../lib/pages';

interface SubjectProgressListProps {
  subjects: SubjectStat[];
  className?: string;
}

export default function SubjectProgressList({ subjects, className = '' }: SubjectProgressListProps) {
  return (
    <div className={`space-y-stack-md ${className}`}>
      {subjects.map((s) => (
        <ProgressBar
          key={s.subject}
          label={s.subject}
          trailing={`${s.percent}%`}
          percent={s.percent}
          barClass={s.barClass}
        />
      ))}
      <Link
        to={pathFor('analysis')}
        className="w-full mt-6 text-primary font-label-lg text-label-lg flex items-center justify-center gap-1 hover:underline"
      >
        View Detail Breakdown
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </div>
  );
}
