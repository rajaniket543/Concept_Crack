import { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  hover?: boolean;
  noPad?: boolean;
}

export default function Card({ title, subtitle, action, children, className = '', hover = false, noPad = false }: CardProps) {
  return (
    <section className={[hover ? 'card-hover' : 'card', noPad ? '!p-0' : '', className].join(' ')}>
      {(title || action) && (
        <div className="card-header">
          <div className="min-w-0">
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="text-body-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 ml-4">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
