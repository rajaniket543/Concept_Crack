import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconAfter?: string;
  loading?: boolean;
  children?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary:  'btn-primary',
  secondary:'btn-secondary',
  outline:  'btn-outline',
  ghost:    'btn-ghost',
  danger:   'btn-danger',
  gradient: 'btn-brand-gradient',
};

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={['btn', variantClass[variant], sizeClass[size], className].join(' ')}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-outlined" style={{ fontSize: size === 'sm' ? '16px' : '18px' }}>{icon}</span>
      ) : null}
      {children}
      {iconAfter && !loading && (
        <span className="material-symbols-outlined" style={{ fontSize: size === 'sm' ? '16px' : '18px' }}>{iconAfter}</span>
      )}
    </button>
  );
}
