import { useEffect, useState } from 'react';
import {
  verifyBeforeUpdateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Card from '../components/Card';
import TopBar from '../components/TopBar';
import { useTheme } from '../lib/theme';
import { getAuthSession, setAuthSession } from '../lib/auth';
import { auth, db } from '../lib/firebase';
import { Col } from '../lib/db';
import { useToast } from '../components/Toast';

const TABS = ['Profile', 'Appearance', 'Notifications', 'Security'] as const;
type SettingsTab = (typeof TABS)[number];

type NotificationPrefs = {
  examReminders: boolean;
  aiInsights: boolean;
  batchAlerts: boolean;
  weeklyDigest: boolean;
  pushEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  examReminders: true,
  aiInsights:    true,
  batchAlerts:   false,
  weeklyDigest:  true,
  pushEnabled:   false,
};

type Msg = { type: 'success' | 'error'; text: string };

function showFor(set: (m: Msg | null) => void, msg: Msg, ms = 4000) {
  set(msg);
  setTimeout(() => set(null), ms);
}

export default function Settings() {
  const { isDark, toggleTheme, fontSize, setFontSize } = useTheme();
  const toast = useToast();
  const session = getAuthSession();
  const [tab, setTab] = useState<SettingsTab>('Profile');

  // ── Profile tab ──────────────────────────────────────────────────────────────
  const originalEmail = session?.user?.email ?? '';
  const [profile, setProfile] = useState({
    name:  session?.user?.name  ?? '',
    email: session?.user?.email ?? '',
    phone: '',
    bio:   '',
  });
  const [profilePwd,    setProfilePwd]    = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState<Msg | null>(null);

  const emailChanged = profile.email.trim() !== originalEmail;

  // Prefill phone/bio and notification prefs from the user's Firestore profile.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, Col.users, uid)).then(snap => {
      if (cancelled || !snap.exists()) return;
      const d = snap.data();
      setProfile(p => ({
        ...p,
        phone: (d.phone as string) ?? (d.mobile as string) ?? '',
        bio:   (d.bio as string) ?? '',
      }));
      if (d.notificationPrefs) {
        setNotifications({ ...DEFAULT_PREFS, ...(d.notificationPrefs as Partial<NotificationPrefs>) });
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile() {
    const uid = session?.user?.id;
    if (!uid || !auth.currentUser) {
      showFor(setProfileMsg, { type: 'error', text: 'Not signed in. Please log in again.' });
      return;
    }
    if (emailChanged && !profilePwd) {
      showFor(setProfileMsg, { type: 'error', text: 'Enter your current password to change email.' });
      return;
    }

    setProfileSaving(true);
    try {
      if (emailChanged) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, profilePwd);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await verifyBeforeUpdateEmail(auth.currentUser, profile.email.trim());
        // Revert email in local state — it only changes after the user clicks the verification link
        setProfile(p => ({ ...p, email: originalEmail }));
        setProfilePwd('');
        showFor(setProfileMsg, {
          type: 'success',
          text: `Verification email sent to ${profile.email.trim()}. Click the link to complete the email change.`,
        }, 8000);
        return;
      }

      await updateDoc(doc(db, Col.users, uid), {
        name:  profile.name.trim(),
        phone: profile.phone.trim(),
        bio:   profile.bio.trim(),
      });

      if (session) {
        setAuthSession({
          ...session,
          user: { ...session.user, name: profile.name.trim() },
        });
      }

      setProfilePwd('');
      showFor(setProfileMsg, { type: 'success', text: 'Profile updated successfully.' });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const message =
        code === 'auth/wrong-password'          ? 'Current password is incorrect.'
        : code === 'auth/requires-recent-login' ? 'Session expired. Please log out and log in again.'
        : code === 'auth/email-already-in-use'  ? 'That email is already in use by another account.'
        : code === 'auth/invalid-email'         ? 'Invalid email address.'
        : (err as Error).message ?? 'Failed to update profile.';
      showFor(setProfileMsg, { type: 'error', text: message });
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Notifications tab — persisted on the user's profile ─────────────────────
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_PREFS);

  function toggleNotification(key: keyof NotificationPrefs) {
    setNotifications(n => {
      const next = { ...n, [key]: !n[key] };
      const uid = session?.user?.id;
      if (uid) {
        setDoc(doc(db, Col.users, uid), { notificationPrefs: next }, { merge: true })
          .catch(() => toast('Could not save the preference — try again.', 'error'));
      }
      return next;
    });
  }

  // ── Security tab ─────────────────────────────────────────────────────────────
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityMsg,    setSecurityMsg]    = useState<Msg | null>(null);

  async function handleChangePassword() {
    if (!security.newPassword) {
      showFor(setSecurityMsg, { type: 'error', text: 'Enter a new password.' });
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      showFor(setSecurityMsg, { type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (security.newPassword.length < 6) {
      showFor(setSecurityMsg, { type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (!auth.currentUser || !session?.user?.email) {
      showFor(setSecurityMsg, { type: 'error', text: 'Not signed in. Please log in again.' });
      return;
    }

    setSecuritySaving(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, security.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, security.newPassword);
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showFor(setSecurityMsg, { type: 'success', text: 'Password updated successfully.' });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      const message =
        code === 'auth/wrong-password'          ? 'Current password is incorrect.'
        : code === 'auth/requires-recent-login' ? 'Session expired. Please log out and log in again.'
        : code === 'auth/weak-password'         ? 'Password is too weak. Use at least 6 characters.'
        : (err as Error).message ?? 'Failed to update password.';
      showFor(setSecurityMsg, { type: 'error', text: message });
    } finally {
      setSecuritySaving(false);
    }
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

                {/* Current password — required only when changing email */}
                {emailChanged && (
                  <div>
                    <label className="text-label-sm font-semibold mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                      Current Password
                      <span className="ml-1 font-normal" style={{ color: '#F97316' }}>(required to change email)</span>
                    </label>
                    <input
                      type="password"
                      value={profilePwd}
                      onChange={e => setProfilePwd(e.target.value)}
                      placeholder="Enter your current password"
                      className="input-field w-full"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="btn-primary btn-md"
                    style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', opacity: profileSaving ? 0.7 : 1 }}
                  >
                    {profileSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {profileMsg && (
                    <span
                      className="flex items-center gap-1.5 text-body-md"
                      style={{ color: profileMsg.type === 'success' ? '#10B981' : '#EF4444' }}
                    >
                      <span className="material-symbols-outlined filled" style={{ fontSize: '18px' }}>
                        {profileMsg.type === 'success' ? 'check_circle' : 'error'}
                      </span>
                      {profileMsg.text}
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
                        Switch between light and dark theme (also available in the top bar)
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
                    aria-label="Toggle dark mode"
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
                    {(['compact', 'default', 'comfortable'] as const).map(size => {
                      const isActive = fontSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setFontSize(size)}
                          className="p-3 rounded-xl text-body-md font-medium capitalize transition-all"
                          style={isActive
                            ? { backgroundColor: 'rgba(91,79,232,0.10)', color: '#5B4FE8', border: '1.5px solid #5B4FE8' }
                            : { backgroundColor: 'var(--surface-muted)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }
                          }
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── Notifications ── */}
          {tab === 'Notifications' && (
            <Card title="Notification Preferences" subtitle="Control what alerts you receive from Concept Crack">
              <div className="space-y-3">
                {(
                  [
                    { key: 'examReminders',  label: 'Exam Reminders',         description: 'Get notified 1 hour before scheduled exams' },
                    { key: 'aiInsights',     label: 'AI Insights',            description: 'Personalized learning tips from Concept Crack' },
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
                      onClick={() => toggleNotification(key)}
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
                      disabled={securitySaving}
                      className="btn-primary btn-md"
                      style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)', opacity: securitySaving ? 0.7 : 1 }}
                    >
                      {securitySaving ? 'Updating…' : 'Update Password'}
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

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
