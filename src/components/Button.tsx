import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  children?: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container',
  secondary: 'bg-secondary text-on-secondary hover:opacity-90',
  outline: 'border border-outline text-on-surface hover:bg-surface-container',
  ghost: 'text-on-surface hover:bg-surface-container',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-label-md',
  md: 'h-10 px-4 text-label-lg',
  lg: 'h-12 px-6 text-label-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 rounded font-semibold transition',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(' ')}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  );
}
