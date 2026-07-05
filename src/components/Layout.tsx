import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { PageKey, pathFor } from '../lib/pages';
import { logout } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useState } from 'react';
import AICompanion from './AICompanion';

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
  const { theme, toggleTheme, isDark } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const roleAccent: Record<string, string> = {
    student: '#5B4FE8',
    faculty: '#14B8A6',
    parent:  '#F97316',
    admin:   '#EC4899',
  };
  const accent = roleAccent[role] ?? '#5B4FE8';
  const homePath = pathFor(role as PageKey);

  if (variant === 'focus') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    );
  }

  // Normalize nav to sections
  const sections: NavSection[] = nav.every(isNavSection)
    ? (nav as NavSection[])
    : [{ items: nav as NavItem[] }];

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
      >
        <span className="material-symbols-outlined item-icon">{item.icon}</span>
        {!collapsed && <span className="truncate text-sm">{item.label}</span>}
      </Link>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className="shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto transition-all duration-200"
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
          style={{ height: '64px', borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <Link to={homePath} className="flex items-center gap-3 min-w-0" title="Go to dashboard">
            <img
              src="/logo.png"
              alt="Concept Crack"
              className="w-8 h-8 rounded-lg object-cover shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-headline font-bold text-white text-sm tracking-tight truncate">Concept Crack</div>
                <div className="text-[10px] uppercase tracking-widest truncate" style={{ color: 'var(--sidebar-text-muted)' }}>{brand}</div>
              </div>
            )}
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
          {sections.map((section, si) => (
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

        {/* Footer */}
        <div
          className="px-2 py-3 space-y-0.5 shrink-0"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            title={collapsed ? (isDark ? 'Light mode' : 'Dark mode') : undefined}
            className="sidebar-item w-full"
          >
            <span className="material-symbols-outlined item-icon">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            {!collapsed && <span className="text-sm">{isDark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <Link
            to={pathFor('landing')}
            title={collapsed ? 'Home' : undefined}
            className="sidebar-item"
          >
            <span className="material-symbols-outlined item-icon">home</span>
            {!collapsed && <span className="text-sm">Home</span>}
          </Link>
          <Link
            to="/built-by-arcvion"
            title={collapsed ? 'Built by Arcvion' : undefined}
            className="sidebar-item"
          >
            <span className="material-symbols-outlined item-icon">code</span>
            {!collapsed && <span className="text-sm">Built by Arcvion</span>}
          </Link>
          <button
            type="button"
            title={collapsed ? 'Sign out' : undefined}
            onClick={async () => { await logout(); navigate(pathFor('login')); }}
            className="sidebar-item w-full"
          >
            <span className="material-symbols-outlined item-icon">logout</span>
            {!collapsed && <span className="text-sm">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
        <Outlet />
      </div>

      {/* AI Companion — students only, hidden during exams (focus variant) */}
      {role === 'student' && <AICompanion />}
    </div>
  );
}
