import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession, logout } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { pathFor } from '../lib/pages';

interface TopBarProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  showSearch?: boolean;
}

export default function TopBar({ title, breadcrumb, actions, showSearch = true }: TopBarProps) {
  const session = getAuthSession();
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  const userName = session?.user?.name ?? 'User';
  const userRole = session?.user?.role ?? '';

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  async function handleLogout() {
    await logout();
    navigate(pathFor('login'));
  }

  return (
    <header
      className="flex items-center gap-4 px-6 shrink-0"
      style={{
        height: '64px',
        backgroundColor: 'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
        zIndex: 50,
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Breadcrumb / Title */}
      <div className="flex-1 min-w-0">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-body-sm" style={{ color: 'var(--text-muted)' }}>
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:underline transition-colors"
                    style={{ color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span style={{ color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="text-title-lg font-headline truncate" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        ) : null}
      </div>

      {/* Search */}
      {showSearch && (
        <div className="hidden md:block">
          <div className="search-bar w-72">
            <span className="material-symbols-outlined text-[18px] shrink-0">search</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topics, questions..."
              className="flex-1 bg-transparent outline-none text-body-md"
              style={{ color: 'var(--text-primary)', minWidth: 0 }}
            />
          </div>
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {actions}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn icon-btn-md"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="icon-btn icon-btn-md relative"
          title="Notifications"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: '#EF4444' }}
            aria-hidden="true"
          />
        </button>

        {/* User avatar + dropdown */}
        <div className="relative ml-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg transition-colors hover:bg-[var(--surface-muted)]"
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            <div className="avatar avatar-md" aria-hidden="true">
              {userInitials}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-label-lg leading-tight truncate max-w-28" style={{ color: 'var(--text-primary)' }}>{userName}</div>
              <div className="text-label-sm capitalize" style={{ color: 'var(--text-muted)' }}>{userRole}</div>
            </div>
            <span className="material-symbols-outlined text-[16px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>expand_more</span>
          </button>

          {menuOpen && (
            <div
              className="dropdown right-0 mt-1"
              style={{ minWidth: '200px' }}
            >
              <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="text-label-lg" style={{ color: 'var(--text-primary)' }}>{userName}</div>
                <div className="text-body-sm capitalize" style={{ color: 'var(--text-muted)' }}>{userRole}</div>
              </div>
              <div className="py-1">
                <button type="button" className="dropdown-item">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Profile
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); navigate(pathFor('settings')); }} className="dropdown-item">
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  Settings
                </button>
                <button type="button" className="dropdown-item">
                  <span className="material-symbols-outlined text-[18px]">help</span>
                  Help & Support
                </button>
                <div className="my-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                <button type="button" onClick={handleLogout} className="dropdown-item danger">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
