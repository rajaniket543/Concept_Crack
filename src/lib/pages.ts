export type PageGroup = 'Main' | 'Student' | 'Parent' | 'Faculty' | 'Admin';

export type PageKey =
  | 'landing'
  | 'login'
  | 'student'
  | 'streamSelect'
  | 'practice'
  | 'exam'
  | 'analysis'
  | 'chatbot'
  | 'insights'
  | 'leaderboard'
  | 'parent'
  | 'faculty'
  | 'questionBank'
  | 'studentDetail'
  | 'admin'
  | 'users'
  | 'institutes'
  | 'settings';

export type LoginRole = 'student' | 'parent' | 'faculty' | 'admin';

export interface PageDef {
  key: PageKey;
  label: string;
  group: PageGroup;
  path: string;
}

export const pages: PageDef[] = [
  { key: 'landing', label: 'Landing', group: 'Main', path: '/about' },
  { key: 'login', label: 'Login', group: 'Main', path: '/login' },
  { key: 'student', label: 'Student Dashboard', group: 'Student', path: '/student' },
  { key: 'streamSelect', label: 'Select Stream', group: 'Student', path: '/student/select-stream' },
  { key: 'practice', label: 'Practice Module', group: 'Student', path: '/student/practice' },
  { key: 'exam', label: 'Exam Interface', group: 'Student', path: '/student/exam' },
  { key: 'analysis', label: 'Test Analysis', group: 'Student', path: '/student/analysis' },
  { key: 'chatbot', label: 'AI Tutor Chat', group: 'Student', path: '/student/chatbot' },
  { key: 'insights', label: 'AI Insights', group: 'Student', path: '/student/insights' },
  { key: 'leaderboard', label: 'Leaderboard', group: 'Student', path: '/student/leaderboard' },
  { key: 'parent', label: 'Parent Dashboard', group: 'Parent', path: '/parent' },
  { key: 'faculty', label: 'Faculty Dashboard', group: 'Faculty', path: '/faculty' },
  { key: 'questionBank', label: 'Question Bank', group: 'Faculty', path: '/faculty/questions' },
  { key: 'studentDetail', label: 'Student Detail', group: 'Faculty', path: '/faculty/student' },
  { key: 'admin', label: 'Admin Dashboard', group: 'Admin', path: '/admin' },
  { key: 'users', label: 'User Management', group: 'Admin', path: '/admin/users' },
  { key: 'institutes', label: 'Institute Management', group: 'Admin', path: '/admin/institutes' },
  { key: 'settings', label: 'Settings', group: 'Main', path: '/settings' },
];

export const pageByKey: Record<PageKey, PageDef> = pages.reduce(
  (acc, p) => ({ ...acc, [p.key]: p }),
  {} as Record<PageKey, PageDef>
);

export function pathFor(key: PageKey): string {
  return pageByKey[key].path;
}

export function currentKey(pathname: string): PageKey {
  const match = pages.find((p) => p.path === pathname);
  return match ? match.key : 'landing';
}

export const loginPathByRole: Record<LoginRole, PageKey> = {
  student: 'student',
  parent: 'parent',
  faculty: 'faculty',
  admin: 'admin',
};
