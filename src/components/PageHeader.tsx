import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  chip?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, chip, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-display-sm font-headline" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {chip}
        </div>
        {subtitle && (
          <p className="text-body-md mt-1.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
