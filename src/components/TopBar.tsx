import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthSession, logout } from '../lib/auth';
import { pathFor } from '../lib/pages';
import { getUserNotifications, markNotificationsRead, type AppNotification } from '../lib/db';
import { useConfirm } from './ConfirmDialog';
import { useTheme } from '../lib/theme';

interface TopBarProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  /** Kept for backwards compatibility — the global search bar has been removed. */
  showSearch?: boolean;
}

const NOTIF_ICON: Record<string, string> = {
  test:     'quiz',
  approval: 'verified',
  message:  'chat',
  battle:   'sports_esports',
  account:  'person',
  system:   'notifications',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TopBar({ title, breadcrumb, actions }: TopBarProps) {
  const session = getAuthSession();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  const userName = session?.user?.name ?? 'User';
  const userRole = session?.user?.role ?? '';
  const uid = session?.user?.id ?? '';

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getUserNotifications(uid).then(list => { if (!cancelled) setNotifications(list); });
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    if (menuOpen || notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, notifOpen]);

  function openNotifications() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && unreadCount > 0) {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      // Optimistically mark read; persist in the background.
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      void markNotificationsRead(unreadIds);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will be returned to the login page.',
      confirmLabel: 'Sign out',
      tone: 'danger',
      icon: 'logout',
    });
    if (!ok) return;
    await logout();
    navigate(pathFor('login'));
  }

  return (
    <header
      className="topbar flex items-center gap-3 sm:gap-4 px-4 sm:px-6 shrink-0"
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

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {actions}

        {/* Light / dark toggle button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn icon-btn-md"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle light or dark mode"
        >
          <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={openNotifications}
            className="icon-btn icon-btn-md relative"
            title="Notifications"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={notifOpen}
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: '#EF4444' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="dropdown right-0 mt-1 overflow-hidden" style={{ width: '340px' }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <span className="text-label-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                <span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>{notifications.length} recent</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <span className="material-symbols-outlined block mx-auto mb-2" style={{ fontSize: '28px', color: 'var(--text-faint)' }}>notifications_off</span>
                    <p className="text-body-sm" style={{ color: 'var(--text-muted)' }}>No notifications yet</p>
                    <p className="text-label-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>Test results, approvals and messages appear here.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className="px-4 py-3 flex gap-3 border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)', backgroundColor: n.read ? 'transparent' : 'var(--brand-muted)' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'var(--brand-muted)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--brand)' }}>
                          {NOTIF_ICON[n.type] ?? 'notifications'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                        {n.body && <div className="text-label-sm leading-5" style={{ color: 'var(--text-muted)' }}>{n.body}</div>}
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{timeAgo(n.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
                <button type="button" onClick={() => { setMenuOpen(false); navigate(pathFor('settings')); }} className="dropdown-item">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Profile
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); navigate(pathFor('settings')); }} className="dropdown-item">
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  Settings
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); navigate(pathFor('contact')); }} className="dropdown-item">
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
