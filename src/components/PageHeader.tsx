import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="px-container-desktop py-6 border-b border-outline-variant bg-surface-container-lowest flex items-end justify-between gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">{title}</h1>
        {subtitle && <p className="text-body-md text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
