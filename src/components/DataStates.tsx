import type { CSSProperties } from 'react';

/** A single shimmering placeholder block. Uses the `.skeleton` class in index.css. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/**
 * Generic content-area loading placeholder: a header line, a row of stat cards,
 * and two panels. Shown while a page's data is loading so real screens never
 * flash mock/empty content.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton style={{ width: 240, height: 28 }} />
        <Skeleton style={{ width: 340, height: 14 }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton style={{ width: 40, height: 40, marginBottom: 16 }} />
            <Skeleton style={{ width: '60%', height: 24, marginBottom: 8 }} />
            <Skeleton style={{ width: '40%', height: 14 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2" style={{ minHeight: 280 }}>
          <Skeleton style={{ width: '40%', height: 20, marginBottom: 20 }} />
          <Skeleton style={{ width: '100%', height: 200 }} />
        </div>
        <div className="card" style={{ minHeight: 280 }}>
          <Skeleton style={{ width: '50%', height: 20, marginBottom: 20 }} />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ width: '100%', height: 32 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when a page's data fails to load — an honest error with a retry,
 * instead of silently falling back to mock numbers.
 */
export function ErrorState({
  message = "We couldn't load this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-state-icon" style={{ color: 'var(--red)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
          cloud_off
        </span>
      </div>
      <h3 className="empty-state-title">Something went wrong</h3>
      <p className="empty-state-body">{message}</p>
      <button
        type="button"
        className="btn-primary btn-md mt-5"
        style={{ display: 'inline-flex' }}
        onClick={onRetry ?? (() => window.location.reload())}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          refresh
        </span>
        Retry
      </button>
    </div>
  );
}
