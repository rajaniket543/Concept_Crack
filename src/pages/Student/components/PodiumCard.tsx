import { PodiumEntry } from '../../../mocks/student';

interface PodiumCardProps {
  entry: PodiumEntry;
}

const TONE_BORDER: Record<PodiumEntry['tone'], string> = {
  gold: 'border-yellow-400',
  silver: 'border-slate-200',
  bronze: 'border-amber-600/30',
};

const TONE_BADGE: Record<PodiumEntry['tone'], string> = {
  gold: 'bg-yellow-400 text-white border-white',
  silver: 'bg-slate-200 text-slate-800 border-white',
  bronze: 'bg-amber-700/80 text-white border-white',
};

const TONE_PILLAR: Record<PodiumEntry['tone'], string> = {
  gold: 'h-44 border-primary-container bg-primary-container/10',
  silver: 'h-32 border-slate-200 bg-slate-100/50',
  bronze: 'h-24 border-amber-600/30 bg-amber-50/50',
};

const TONE_RING: Record<PodiumEntry['tone'], string> = {
  gold: 'w-20 h-20 md:w-28 md:h-28',
  silver: 'w-16 h-16 md:w-20 md:h-20',
  bronze: 'w-16 h-16 md:w-20 md:h-20',
};

export default function PodiumCard({ entry }: PodiumCardProps) {
  const first = entry.rank === 1;
  return (
    <div className={`flex flex-col items-center ${first ? '-translate-y-6' : ''}`}>
      <div className="relative mb-4">
        <div
          className={`${TONE_RING[entry.tone]} rounded-full border-4 ${TONE_BORDER[entry.tone]} overflow-hidden shadow-lg animate-float`}
          style={{ animationDelay: `${entry.delay}s` }}
        >
          <img alt={`Rank ${entry.rank}`} src={entry.avatarUrl} className="w-full h-full object-cover" />
        </div>
        <div
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${TONE_BADGE[entry.tone]} text-label-md font-bold px-3 py-1 rounded-full border-2 flex items-center gap-1`}
        >
          {first && (
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              stars
            </span>
          )}
          {entry.rank}
        </div>
      </div>
      <p className={`${first ? 'font-title-lg text-title-lg text-primary' : 'font-label-lg text-label-lg text-on-surface'} mb-1`}>
        {entry.name}
      </p>
      <p className={`${first ? 'font-label-lg text-label-lg' : 'font-label-md text-label-md'} text-secondary`}>
        {entry.points.toLocaleString()} pts
      </p>
      <div
        className={`${first ? 'w-28 md:w-40' : 'w-24 md:w-32'} ${TONE_PILLAR[entry.tone]} border-t-4 rounded-t-lg flex flex-col items-center justify-start pt-4`}
      >
        {first && (
          <span className="text-primary-container opacity-20 material-symbols-outlined text-4xl">
            emoji_events
          </span>
        )}
      </div>
    </div>
  );
}
