import { useState } from 'react';
import Card from '../components/Card';
import TopBar from '../components/TopBar';
import { useTheme } from '../lib/theme';
import { getAuthSession } from '../lib/auth';
import { apiRequest } from '../lib/api';

const TABS = ['Profile', 'Appearance', 'Notifications', 'Security', 'Integrations'] as const;
type SettingsTab = (typeof TABS)[number];

export default function Settings() {
  const { isDark, toggleTheme } = useTheme();
  const session = getAuthSession();
  const [tab, setTab] = useState<SettingsTab>('Profile');

  const [profile, setProfile] = useState({
    name: session?.user?.name ?? '',
    email: session?.user?.email ?? '',
    phone: '',
    bio: '',
  });
  const [profileSaved, setProfileSaved] = useState(false);

  const [notifications, setNotifications] = useState({
    examReminders: true,
    aiInsights: true,
    batchAlerts: false,
    weeklyDigest: true,
    pushEnabled: false,
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSaveProfile() {
    try {
      await apiRequest('/api/profile/update', { method: 'POST', body: JSON.stringify(profile) });
    } catch { /* use local state */ }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  async function handleChangePassword() {
    if (!security.newPassword || security.newPassword !== security.confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    try {
      await apiRequest('/api/profile/password', { method: 'POST', body: JSON.stringify(security) });
      setSecurityMsg({ type: 'success', text: 'Password updated successfully.' });
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setSecurityMsg({ type: 'error', text: 'Failed to update password. Please try again.' });
    }
    setTimeout(() => setSecurityMsg(null), 3000);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Settings' }]}
        showSearch={false}
      />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Settings
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              Manage your profile, appearance, and platform preferences
            </p>
          </div>

          {/* Tab navigation */}
          <div className="tab-pills flex-wrap">
            {TABS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`tab-pill ${tab === t ? 'active' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Profile ── */}
          {tab === 'Profile' && (
            <Card title="Profile Information" subtitle="Update your public profile details">
              <div className="space-y-5">
                {/* Avatar row */}
                <div className="flex items-center gap-5">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                  >
                    {profile.name ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{profile.name || 'Your Name'}</div>
                    <div className="text-body-sm capitalize" style={{ color: 'var(--text-muted)' }}>{session?.user?.role ?? 'User'}</div>
                    <button type="button" className="text-label-sm mt-1 font-semibold hover:underline" style={{ color: '#5B4FE8' }}>
                      Change avatar
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                      className="input-field w-full"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      className="input-field w-full"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 98765 43210"
                      className="input-field w-full"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Role</label>
                    <input
                      type="text"
                      value={session?.user?.role ?? ''}
                      disabled
                      className="input-field w-full opacity-60 cursor-not-allowed"
                      style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Bio</label>
                    <textarea
                      value={profile.bio}
                      onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                      rows={3}
                      placeholder="A short note about yourself..."
                      className="input-field w-full resize-none"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="btn-primary btn-md"
                    style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                  >
                    Save Changes
                  </button>
                  {profileSaved && (
                    <span className="flex items-center gap-1.5 text-body-md" style={{ color: '#10B981' }}>
                      <span className="material-symbols-outlined filled" style={{ fontSize: '18px' }}>check_circle</span>
                      Saved successfully
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ── Appearance ── */}
          {tab === 'Appearance' && (
            <Card title="Appearance" subtitle="Customize the look and feel of the platform">
              <div className="space-y-5">
                {/* Theme toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(91,79,232,0.12)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#5B4FE8' }}>{isDark ? 'dark_mode' : 'light_mode'}</span>
                    </div>
                    <div>
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                      </div>
                      <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>
                        Switch between light and dark theme
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    style={{ backgroundColor: isDark ? '#5B4FE8' : 'var(--border)' }}
                    role="switch"
                    aria-checked={isDark}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: isDark ? 'translateX(22px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>

                {/* Font size */}
                <div>
                  <label className="text-label-sm font-semibold mb-3 block" style={{ color: 'var(--text-muted)' }}>Font Size</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Compact', 'Default', 'Comfortable'].map(size => (
                      <button
                        key={size}
                        type="button"
                        className="p-3 rounded-xl text-body-md font-medium transition-all"
                        style={size === 'Default'
                          ? { backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8', border: '1.5px solid #5B4FE8' }
                          : { backgroundColor: 'var(--surface-muted)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }
                        }
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent color */}
                <div>
                  <label className="text-label-sm font-semibold mb-3 block" style={{ color: 'var(--text-muted)' }}>Accent Color</label>
                  <div className="flex items-center gap-3">
                    {[
                      { name: 'Indigo', hex: '#5B4FE8' },
                      { name: 'Violet', hex: '#8B5CF6' },
                      { name: 'Emerald', hex: '#10B981' },
                      { name: 'Rose', hex: '#F43F5E' },
                      { name: 'Amber', hex: '#F59E0B' },
                    ].map(({ name, hex }) => (
                      <button
                        key={name}
                        type="button"
                        title={name}
                        className="w-8 h-8 rounded-full ring-2 ring-offset-2 transition-all"
                        style={hex === '#5B4FE8'
                          ? { backgroundColor: hex, outline: `2px solid ${hex}`, outlineOffset: '2px' }
                          : { backgroundColor: hex }
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── Notifications ── */}
          {tab === 'Notifications' && (
            <Card title="Notification Preferences" subtitle="Control what alerts you receive from PrepMInd">
              <div className="space-y-3">
                {(
                  [
                    { key: 'examReminders',  label: 'Exam Reminders',         description: 'Get notified 1 hour before scheduled exams' },
                    { key: 'aiInsights',     label: 'AI Insights',            description: 'Personalized learning tips from PrepMInd AI' },
                    { key: 'batchAlerts',    label: 'Batch Alerts',           description: 'Faculty updates and batch-wide announcements' },
                    { key: 'weeklyDigest',   label: 'Weekly Digest',          description: 'A summary of your progress every Sunday' },
                    { key: 'pushEnabled',    label: 'Push Notifications',     description: 'Browser push notifications when tab is closed' },
                  ] as const
                ).map(({ key, label, description }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
                      <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifications(n => ({ ...n, [key]: !n[key] }))}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                      style={{ backgroundColor: notifications[key] ? '#5B4FE8' : 'var(--border)' }}
                      role="switch"
                      aria-checked={notifications[key]}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                        style={{ transform: notifications[key] ? 'translateX(22px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Security ── */}
          {tab === 'Security' && (
            <div className="space-y-5">
              <Card title="Change Password" subtitle="Choose a strong password for your account">
                <div className="space-y-4">
                  {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map(field => {
                    const labels: Record<typeof field, string> = {
                      currentPassword: 'Current Password',
                      newPassword:     'New Password',
                      confirmPassword: 'Confirm New Password',
                    };
                    return (
                      <div key={field}>
                        <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                          {labels[field]}
                        </label>
                        <input
                          type="password"
                          value={security[field]}
                          onChange={e => setSecurity(s => ({ ...s, [field]: e.target.value }))}
                          className="input-field w-full"
                          style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                        />
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      className="btn-primary btn-md"
                      style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                    >
                      Update Password
                    </button>
                    {securityMsg && (
                      <span
                        className="flex items-center gap-1.5 text-body-md"
                        style={{ color: securityMsg.type === 'success' ? '#10B981' : '#EF4444' }}
                      >
                        <span className="material-symbols-outlined filled" style={{ fontSize: '18px' }}>
                          {securityMsg.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {securityMsg.text}
                      </span>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account">
                <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#10B981' }}>security</span>
                    </div>
                    <div>
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>Authenticator App</div>
                      <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>Use Google Authenticator or Authy for 2FA</div>
                    </div>
                  </div>
                  <button type="button" className="btn-outline btn-md">Enable</button>
                </div>
              </Card>

              <Card title="Active Sessions" subtitle="Devices currently signed in to your account">
                <div className="space-y-3">
                  {[
                    { device: 'Chrome on Windows 11', location: 'New Delhi, IN', current: true, time: 'Now' },
                    { device: 'Safari on iPhone 15', location: 'Mumbai, IN', current: false, time: '2 days ago' },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ backgroundColor: 'var(--surface-muted)', border: `1px solid ${s.current ? 'rgba(91,79,232,0.20)' : 'var(--border)'}` }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '22px', color: s.current ? '#5B4FE8' : 'var(--text-muted)' }}>
                        {s.device.includes('iPhone') ? 'smartphone' : 'computer'}
                      </span>
                      <div className="flex-1">
                        <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{s.device}</div>
                        <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{s.location} · {s.time}</div>
                      </div>
                      {s.current ? (
                        <span className="badge badge-success text-label-sm">Current</span>
                      ) : (
                        <button type="button" className="text-label-sm font-semibold hover:underline" style={{ color: '#EF4444' }}>
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── Integrations ── */}
          {tab === 'Integrations' && (
            <Card title="Connected Integrations" subtitle="Manage third-party service connections">
              <div className="space-y-3">
                {[
                  { name: 'Google',     icon: 'account_circle', desc: 'Sign in with Google, calendar sync',    connected: true  },
                  { name: 'Slack',      icon: 'forum',          desc: 'Receive notifications in Slack',        connected: false },
                  { name: 'WhatsApp',   icon: 'chat',           desc: 'Send exam reminders via WhatsApp',      connected: false },
                  { name: 'Zoom',       icon: 'videocam',       desc: 'Schedule doubt sessions with faculty',  connected: true  },
                  { name: 'Google Drive', icon: 'folder',       desc: 'Backup reports and study materials',    connected: false },
                ].map(({ name, icon, desc, connected }) => (
                  <div
                    key={name}
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: connected ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.10)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: connected ? '#10B981' : 'var(--text-muted)' }}>{icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</div>
                      <div className="text-body-sm" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                    <button
                      type="button"
                      className={connected ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}
                      style={!connected ? { background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' } : {}}
                    >
                      {connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
