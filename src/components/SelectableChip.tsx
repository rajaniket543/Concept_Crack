import type { ReactNode } from 'react';

export type ChipVariant = 'pill' | 'row' | 'tab';
export type ChipSize = 'sm' | 'md';

interface SelectableChipProps {
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
  /** 'pill' = difficulty/count/level buttons · 'tab' = subject switch bar (count badge) · 'row' = larger card row (icon + label + subtitle + checkbox) */
  variant?: ChipVariant;
  icon?: string;             // Material Symbols name — 'row' only
  subtitle?: ReactNode;      // 'row' only
  count?: number | string;   // shown after label in 'tab' (chapter count) and 'row' (question count)
  color?: string;            // accent — defaults to 'var(--brand)'; pass an institute/arena accent to override
  size?: ChipSize;
  disabled?: boolean;
  fullWidth?: boolean;
  showCheckmark?: boolean;   // checkbox indicator on 'row'; off by default for 'pill'/'tab'
  className?: string;
}

/**
 * A single selectable toggle, covering the three chip shapes that were
 * previously hand-rolled per page (CustomTest.tsx, Battle.tsx's lobby config)
 * with the same brand-color literal retyped at every call site.
 */
export default function SelectableChip({
  label,
  selected,
  onClick,
  variant = 'pill',
  icon,
  subtitle,
  count,
  color = 'var(--brand)',
  size = 'md',
  disabled = false,
  fullWidth = false,
  showCheckmark = variant === 'row',
  className = '',
}: SelectableChipProps) {
  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full text-left rounded-2xl flex items-center gap-4 transition-all ${size === 'sm' ? 'p-3' : 'p-4'} ${className}`}
        style={{
          backgroundColor: selected ? `color-mix(in srgb, ${color} 6%, transparent)` : 'var(--surface)',
          border: `1.5px solid ${selected ? color : 'var(--border)'}`,
          boxShadow: 'var(--shadow-sm)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: selected ? `linear-gradient(135deg, ${color}, var(--violet))` : 'var(--surface-muted)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: selected ? '#fff' : 'var(--text-muted)' }}>
              {icon}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate" style={{ color: selected ? color : 'var(--text-primary)' }}>{label}</div>
          {subtitle && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
        {count !== undefined && (
          <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>{count}</span>
        )}
        {showCheckmark && (
          <div
            className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
            style={{ borderColor: selected ? color : 'var(--border)', backgroundColor: selected ? color : 'transparent' }}
          >
            {selected && <span className="material-symbols-outlined text-white" style={{ fontSize: 13 }}>check</span>}
          </div>
        )}
      </button>
    );
  }

  if (variant === 'tab') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`px-4 py-2 rounded-xl text-sm font-semibold shrink-0 transition-all ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          backgroundColor: selected ? color : 'var(--surface)',
          color: selected ? '#fff' : 'var(--text-muted)',
          border: `1.5px solid ${selected ? color : 'var(--border)'}`,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon && (
          <span className={`material-symbols-outlined align-middle mr-1 ${selected ? 'filled' : ''}`} style={{ fontSize: 16 }}>
            {icon}
          </span>
        )}
        {label}
        {count !== undefined && <span className="opacity-80"> ({count})</span>}
      </button>
    );
  }

  // 'pill'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl text-sm font-semibold transition-all ${size === 'sm' ? 'py-1.5 px-3' : 'py-2.5'} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{
        backgroundColor: selected ? color : 'var(--surface)',
        color: selected ? '#fff' : 'var(--text-muted)',
        border: `1.5px solid ${selected ? color : 'var(--border)'}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
