import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

// App-wide replacement for window.confirm / window.alert. Every destructive or
// important action asks through this dialog so the whole platform shows one
// consistent, branded confirmation UI instead of the browser default.

export type DialogTone = 'default' | 'danger' | 'warning' | 'success';

export interface ConfirmOptions {
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  icon?: string;           // material symbol name
  hideCancel?: boolean;    // alert-style: single OK button
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: async () => false });

const TONE_META: Record<DialogTone, { color: string; bg: string; icon: string; button: string }> = {
  default: { color: '#5B4FE8', bg: 'rgba(91,79,232,0.12)',  icon: 'help',    button: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' },
  danger:  { color: '#DC2626', bg: 'rgba(239,68,68,0.12)',  icon: 'warning', button: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  warning: { color: '#D97706', bg: 'rgba(245,158,11,0.12)', icon: 'error',   button: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  success: { color: '#059669', bg: 'rgba(16,185,129,0.12)', icon: 'check_circle', button: 'linear-gradient(135deg, #10B981, #059669)' },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setCurrent(opts);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setCurrent(null);
  }, []);

  // Keyboard: Esc cancels, Enter confirms
  useEffect(() => {
    if (!current) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Enter')  { e.preventDefault(); close(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, close]);

  const meta = TONE_META[current?.tone ?? 'default'];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {current && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(3,7,18,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget && !current.hideCancel) close(false); }}
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: meta.bg }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: meta.color }}>
                {current.icon ?? meta.icon}
              </span>
            </div>
            <h2 className="text-lg font-bold text-center mb-1.5" style={{ color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {current.title}
            </h2>
            <div className="text-sm text-center leading-6 mb-5" style={{ color: 'var(--text-muted)' }}>
              {current.message}
            </div>
            <div className="flex gap-3">
              {!current.hideCancel && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="flex-1 btn-outline btn-md justify-center"
                >
                  {current.cancelLabel ?? 'Cancel'}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className="flex-1 btn-primary btn-md justify-center"
                style={{ background: meta.button }}
              >
                {current.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}
