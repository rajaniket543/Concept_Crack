import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { PageKey, pathFor } from '../lib/pages';
import { logout } from '../lib/auth';
import Logo from './Logo';
import { useEffect, useState } from 'react';
import AICompanion from './AICompanion';
import { useConfirm } from './ConfirmDialog';

interface NavSection {
  label?: string;
  items: NavItem[];
}

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}

interface LayoutProps {
  brand: string;
  role?: 'student' | 'faculty' | 'parent' | 'admin';
  nav: NavItem[] | NavSection[];
  variant?: 'default' | 'focus';
}

function isNavSection(x: NavItem | NavSection): x is NavSection {
  return 'items' in x;
}

export default function Layout({ brand, role = 'student', nav, variant = 'default' }: LayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const roleAccent: Record<string, string> = {
    student: '#6B5EF0',
    faculty: '#14B8A6',
    parent:  '#F97316',
    admin:   '#EC4899',
  };
  const accent = roleAccent[role] ?? '#6B5EF0';
  const homePath = pathFor(role as PageKey);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileNavOpen]);

  if (variant === 'focus') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    );
  }

  // Normalize nav to sections. The "Account" section (Settings, Contact) is
  // pinned to the bottom of the panel — common across all portals.
  const sections: NavSection[] = nav.every(isNavSection)
    ? (nav as NavSection[])
    : [{ items: nav as NavItem[] }];
  const mainSections    = sections.filter(s => s.label !== 'Account');
  const accountSections = sections.filter(s => s.label === 'Account');

  const sidebarWidth = collapsed ? '60px' : '260px';

  // Highlight only the MOST specific matching nav item, so that e.g.
  // /student/assigned-tests does not also light up the /student dashboard item.
  const activeKey = sections
    .flatMap(s => s.items)
    .reduce<{ key: string; len: number }>((best, it) => {
      const t = pathFor(it.key);
      const matches = pathname === t || pathname.startsWith(t + '/');
      return matches && t.length > best.len ? { key: it.key, len: t.length } : best;
    }, { key: '', len: -1 }).key;

  async function handleSignOut() {
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

  function renderNavItem(item: NavItem) {
    const target = pathFor(item.key);
    const active = item.key === activeKey;
    return (
      <Link
        key={item.key}
        to={target}
        title={collapsed ? item.label : undefined}
        className={`sidebar-item ${active ? 'active' : ''}`}
        style={active ? { backgroundColor: accent } : undefined}
        onClick={() => setMobileNavOpen(false)}
      >
        <span className="material-symbols-outlined item-icon">{item.icon}</span>
        {!collapsed && <span className="truncate text-sm">{item.label}</span>}
      </Link>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="sidebar shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto transition-transform duration-200 lg:transition-all"
        data-mobile-open={mobileNavOpen ? 'true' : 'false'}
        style={{
          width: sidebarWidth,
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          zIndex: 40,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{ height: '68px', borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <Link to={homePath} className="flex items-center gap-3 min-w-0" title="Go to dashboard">
            <Logo size="md" tone="onDark" showText={!collapsed} />
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="ml-auto w-6 h-6 flex items-center justify-center rounded transition-colors"
              style={{ color: 'var(--sidebar-text-muted)' }}
              title="Collapse sidebar"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_left</span>
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="mx-auto mt-3 w-8 h-8 flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--sidebar-text-muted)', backgroundColor: 'var(--sidebar-hover)' }}
            title="Expand sidebar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {mainSections.map((section, si) => (
            <div key={si}>
              {section.label && !collapsed && (
                <div
                  className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-widest font-semibold"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                >
                  {section.label}
                </div>
              )}
              {section.items.map(renderNavItem)}
            </div>
          ))}
        </nav>

        {/* Footer — Account section (Settings etc.), then sign out.
            The light/dark toggle lives in the top bar and in Settings only. */}
        <div
          className="px-2 py-3 space-y-0.5 shrink-0"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          {accountSections.flatMap(s => s.items).map(renderNavItem)}
          <button
            type="button"
            title={collapsed ? 'Sign out' : undefined}
            onClick={handleSignOut}
            className="sidebar-item w-full"
          >
            <span className="material-symbols-outlined item-icon">logout</span>
            {!collapsed && <span className="text-sm">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="lg:hidden fixed top-4 left-4 z-30">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        <Outlet />
      </div>

      {/* AI Companion — students only, hidden during exams (focus variant) */}
      {role === 'student' && <AICompanion />}
    </div>
  );
}
