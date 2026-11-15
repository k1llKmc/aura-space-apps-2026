'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '@/components/auth/session-provider';
import { LoginScreen } from '@/components/auth/login-screen';
import { Badge, Button, ErrorState, Modal } from '@/components/ui/ui';
import { CommDelayBadge } from '@/components/ui/aura';
import { DEMO_MODE, DEMO_STORAGE } from '@/demo/config';
import { ThemeToggle } from '@/components/experience/theme';
import { asset } from '@/components/experience/format';
import { useNotifications } from '@/components/ui/notifications';
import { WorkspaceProvider, useWorkspace } from './workspace-provider';

const links = [
  {
    href: '/mission-control',
    label: 'Mission Control',
    icon: '◈',
    section: 'Operations',
  },
  { href: '/crew', label: 'Crew Overview', icon: '◎', section: 'Operations' },
  {
    href: '/daily-check',
    label: 'Daily Health Check',
    icon: '✓',
    section: 'Operations',
  },
  { href: '/alerts', label: 'Alerts', icon: '!', section: 'Operations' },
  {
    href: '/simulator',
    label: 'Mission Risk Simulator',
    icon: '◇',
    section: 'Resources',
  },
  {
    href: '/protocols',
    label: 'Countermeasure Protocols',
    icon: '≡',
    section: 'Resources',
  },
  {
    href: '/settings',
    label: 'Settings / Access',
    icon: '⚙',
    section: 'Resources',
  },
];
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (!user) return <LoginScreen />;
  return (
    <WorkspaceProvider
      key={`${user.id}/${user.role}/${user.missionId}/${user.crewMemberId}`}
    >
      <ShellContent>{children}</ShellContent>
    </WorkspaceProvider>
  );
}
function Navigation({ navigate }: { navigate?: () => void }) {
  const path = usePathname().replace(/\/$/, '') || '/';
  return (
    <nav aria-label="Primary navigation">
      {['Operations', 'Resources'].map((section) => (
        <div key={section} className="nav-group">
          <p className="nav-group-label">{section}</p>
          {links
            .filter((link) => link.section === section)
            .map((link) => {
              const active =
                path === link.href ||
                (link.href === '/crew' && path.startsWith('/crew/'));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={navigate}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-link ${active ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
function ShellContent({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const { mission, alerts } = useWorkspace();
  const notices = useNotifications();
  const [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false),
    [leaving, setLeaving] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const newestWarning = useRef(0);
  const path = usePathname().replace(/\/$/, '') || '/';
  useEffect(() => {
    setMenu(false);
    setNotifications(false);
  }, [path]);
  useEffect(() => {
    if (!alerts.data) return;
    if (seen.current)
      for (const alert of alerts.data.items)
        if (
          !seen.current.has(alert.id) &&
          Date.parse(alert.createdAt) > newestWarning.current
        )
          notices.notify(
            `New warning: ${alert.title}`,
            alert.severity === 'CRITICAL' ? 'error' : 'info',
          );
    seen.current = new Set([
      ...(seen.current || []),
      ...alerts.data.items.map((alert) => alert.id),
    ]);
    newestWarning.current = Math.max(
      newestWarning.current,
      ...alerts.data.items.map((alert) => Date.parse(alert.createdAt)),
    );
    // Notice state updates must not rescan already seen warnings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.data]);
  const current = links.find((link) => link.href === path);
  const isProfile = path.startsWith('/crew/');
  async function signOut() {
    if (DEMO_MODE) {
      localStorage.removeItem(DEMO_STORAGE);
      window.location.reload();
      return;
    }
    setLeaving(true);
    await logout();
    setLeaving(false);
  }
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link
          href="/mission-control"
          className="brand"
          aria-label="AURA Mission Control"
        >
          <img
            className="aura-wordmark"
            src={asset('/aura-logo.png')}
            alt="AURA"
          />
        </Link>
        <Navigation />
        <div className="sidebar-footer">
          <span
            className={`connection-dot ${mission.error ? 'degraded' : ''}`}
          />
          {mission.error
            ? 'Mission connection unavailable'
            : mission.data
              ? DEMO_MODE
                ? 'Synthetic mission · local demo'
                : 'Onboard API connected'
              : 'Connecting to mission…'}
          <p className="mt-2 text-xs text-slate-500">
            Astronaut Unified Risk Assessment
          </p>
        </div>
      </aside>
      <div className="workspace">
        {DEMO_MODE && (
          <div className="demo-banner">
            <span>
              <strong>Interactive mission demo</strong> · Fictional crew and
              synthetic health data. Changes stay in this browser.
            </span>
            <button
              className="button button-secondary"
              onClick={() => {
                localStorage.removeItem(DEMO_STORAGE);
                window.location.reload();
              }}
            >
              Reset demo
            </button>
          </div>
        )}
        <header className="topbar">
          <div className="topbar-main">
            <Button
              className="mobile-menu"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              ☰
            </Button>
            <div className="min-w-0">
              <p className="topbar-mission">
                {mission.data?.name || 'Mission workspace'}
              </p>
              <p className="muted text-xs">
                {mission.data
                  ? `${mission.data.phase} · Day ${mission.data.missionDay}`
                  : mission.error
                    ? 'Mission data unavailable'
                    : 'Loading mission…'}
              </p>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <div className="comm-delay" title="Mission communication delay">
              <CommDelayBadge value={mission.data?.commDelayFormatted} />
            </div>
            {mission.data && (
              <span className="topbar-environment">
                <Badge
                  value={mission.data.environment.status}
                  label={`Environment: ${mission.data.environment.status}`}
                />
              </span>
            )}
            <Button
              aria-label="Notifications"
              onClick={() => {
                setNotifications(true);
                notices.markRead();
              }}
              className="notification-button"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
                <path d="M9 21h6" />
              </svg>
              <span className="notification-count">
                {alerts.data?.total ?? '…'}
              </span>
            </Button>
            <Button disabled={leaving} onClick={signOut}>
              {DEMO_MODE
                ? 'Reset workspace'
                : leaving
                  ? 'Signing out…'
                  : 'Sign out'}
            </Button>
          </div>
        </header>
        <div className="workspace-content">
          <div className="context-bar">
            <nav aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link href="/mission-control">AURA</Link>
                </li>
                {isProfile && (
                  <li>
                    <Link href="/crew">Crew Overview</Link>
                  </li>
                )}
                <li aria-current="page">
                  {isProfile ? 'Crew Profile' : current?.label || 'Workspace'}
                </li>
              </ol>
            </nav>
            <span className="text-xs text-slate-400">
              {user!.username} · {user!.role.replaceAll('_', ' ')}
            </span>
          </div>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <footer className="workspace-footer">
            AURA · Onboard mission workspace · AI generated
            <span>Risk and data freshness are assessed separately.</span>
          </footer>
        </div>
      </div>
      <Modal open={menu} title="Navigation" onClose={() => setMenu(false)}>
        <Navigation navigate={() => setMenu(false)} />
      </Modal>
      <Modal
        open={notifications}
        title="Notifications"
        onClose={() => setNotifications(false)}
      >
        <div className="space-y-5">
          <section>
            <h3 className="mb-3 font-medium">Active warnings</h3>
            {alerts.error && (
              <ErrorState message={alerts.error} retry={alerts.refresh} />
            )}
            {alerts.data?.items.map((alert) => (
              <Link
                className="notification-item"
                href="/alerts"
                key={alert.id}
                onClick={() => setNotifications(false)}
              >
                <Badge value={alert.severity} />
                <span>{alert.title}</span>
              </Link>
            ))}
            {alerts.data?.total === 0 && (
              <p className="muted">No active warnings.</p>
            )}
            <Link
              className="text-link mt-3 inline-block"
              href="/alerts"
              onClick={() => setNotifications(false)}
            >
              View all warnings →
            </Link>
          </section>
          <section>
            <div className="mb-3 flex justify-between gap-3">
              <h3 className="font-medium">Recent activity</h3>
              <Button
                onClick={notices.clear}
                disabled={!notices.notices.length}
              >
                Clear
              </Button>
            </div>
            {notices.notices.length === 0 && (
              <p className="muted">
                Actions and updates appear here during your session.
              </p>
            )}
            {notices.notices.map((notice) => (
              <div
                key={notice.id}
                className="notification-item flex-col items-start"
              >
                <span>{notice.message}</span>
                <time className="muted text-xs">
                  {new Date(notice.createdAt).toLocaleTimeString()}
                </time>
              </div>
            ))}
          </section>
        </div>
      </Modal>
    </div>
  );
}
