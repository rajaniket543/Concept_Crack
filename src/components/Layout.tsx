import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { PageKey, pathFor } from '../lib/pages';
import { getAuthSession } from '../lib/auth';
import { useEffect, useState, type CSSProperties } from 'react';
import AICompanion from './AICompanion';
import Logo from './Logo';
import { getStudentStream } from '../lib/stream';

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const session = getAuthSession();
  const studentStream = role === 'student' ? getStudentStream() : null;
  const footerMeta =
    role === 'student'
      ? `${studentStream ?? 'JEE'} 2027 · Student`
      : role === 'faculty'
        ? 'Faculty Portal'
        : role === 'parent'
          ? 'Parent Portal'
          : 'Admin Portal';

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
        className={`sidebar-item ${active ? 'active' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      >
        <span className="material-symbols-outlined item-icon">{item.icon}</span>
        <span className="truncate text-sm">{item.label}</span>
      </Link>
    );
  }

  const shellStyle = {
    backgroundColor: '#0B0B13',
    '--bg': '#0B0B13',
    '--surface': '#15151F',
    '--surface-muted': '#1D1D2E',
    '--surface-hover': '#232338',
    '--border': 'rgba(255,255,255,0.06)',
    '--border-muted': 'rgba(255,255,255,0.04)',
    '--text-primary': '#F5F5F8',
    '--text-secondary': '#C7C7D4',
    '--text-muted': '#A1A1AA',
    '--text-faint': '#6B7280',
    '--topbar-bg': 'rgba(11,11,19,0.75)',
    '--topbar-border': 'rgba(255,255,255,0.06)',
    '--brand-light': 'rgba(107,94,240,0.18)',
    '--brand-muted': 'rgba(107,94,240,0.14)',
  } as CSSProperties;

  return (
    <div className="min-h-screen flex" style={shellStyle}>
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
        className={`sidebar shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto transition-transform duration-200 lg:transition-all sidebar-${role}`}
        data-mobile-open={mobileNavOpen ? 'true' : 'false'}
        style={{
          width: '278px',
          minWidth: '278px',
          zIndex: 40,
          '--sidebar-accent': accent,
        } as CSSProperties}
      >
        <div className="brand">
          <Link to={homePath} className="flex items-center min-w-0" title={`Go to ${brand}`}>
            <Logo size="md" tone="onDark" truncate={false} />
          </Link>
        </div>

        <div className="nav-scroll-guard">
          {mainSections.map((section, si) => (
            <div key={si} className="nav-group">
              {section.label && (
                <div className="nav-label">{section.label}</div>
              )}
              {section.items.map(renderNavItem)}
            </div>
          ))}
          <div className="nav-group" style={{ marginTop: 'auto' }}>
            {accountSections.flatMap(s => s.items).map(renderNavItem)}
          </div>
        </div>

        <div className="nav-footer">
          <button
            type="button"
            onClick={() => navigate(pathFor('settings'))}
            className="user-chip"
            title="Open settings"
          >
            <div className="user-avatar">
              {session?.user?.name
                ? session.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                : 'CC'}
            </div>
            <div className="user-meta">
              <div className="u-name">{session?.user?.name ?? 'Concept Crack'}</div>
              <div className="u-role">{footerMeta}</div>
            </div>
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
