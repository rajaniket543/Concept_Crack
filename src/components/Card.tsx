import { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, action, children, className = '' }: CardProps) {
  return (
    <section
      className={[
        'bg-surface-container-lowest border border-outline-variant rounded-lg p-card shadow-elev-1',
        className,
      ].join(' ')}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-title-lg text-on-surface">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
