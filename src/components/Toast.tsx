import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const variantMeta: Record<ToastVariant, { icon: string; color: string }> = {
  success: { icon: 'check_circle', color: 'var(--emerald)' },
  error: { icon: 'error', color: 'var(--red)' },
  info: { icon: 'info', color: 'var(--brand)' },
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(current => current.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = ++counter;
      setToasts(current => [...current, { id, message, variant }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-6 right-6 flex flex-col gap-3"
        style={{ zIndex: 100 }}
      >
        {toasts.map(t => {
          const meta = variantMeta[t.variant];
          return (
            <div key={t.id} className="toast" role="status">
              <span className="material-symbols-outlined shrink-0" style={{ fontSize: 20, color: meta.color }}>
                {meta.icon}
              </span>
              <p className="text-body-md flex-1" style={{ color: 'var(--text-primary)', margin: 0 }}>
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="icon-btn icon-btn-sm shrink-0"
                aria-label="Dismiss notification"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}
