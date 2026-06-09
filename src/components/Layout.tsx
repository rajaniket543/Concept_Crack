import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { PageKey, pathFor } from '../lib/pages';
import { logout } from '../lib/auth';

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}

interface LayoutProps {
  brand: string;
  nav: NavItem[];
  /**
   * 'default' = deep-blue sidebar with nav.
   * 'focus'  = no sidebar, full-bleed main area (used by the exam screen).
   */
  variant?: 'default' | 'focus';
}

export default function Layout({ brand, nav, variant = 'default' }: LayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (variant === 'focus') {
    return (
      <div className="min-h-screen flex flex-col bg-background text-on-surface">
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-on-surface">
      <aside className="w-64 shrink-0 bg-primary text-on-primary flex flex-col">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-md bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container">psychology</span>
          </div>
          <div>
            <div className="font-extrabold tracking-tight">PrepMind AI</div>
            <div className="text-[11px] uppercase tracking-widest text-on-primary-container/80">{brand}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const target = pathFor(item.key);
            const active = pathname === target;
            return (
              <Link
                key={item.key}
                to={target}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold',
                  active ? 'bg-white/15 text-on-primary' : 'text-on-primary/80 hover:bg-white/10',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            to={pathFor('landing')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-on-primary/80 hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[20px]">home</span>
            Home
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate(pathFor('login'));
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-on-primary/80 hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
