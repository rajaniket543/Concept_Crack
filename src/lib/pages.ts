export type PageGroup = 'Main' | 'Student' | 'Parent' | 'Faculty' | 'Admin';

export type PageKey =
  | 'landing'
  | 'login'
  | 'student'
  | 'practice'
  | 'exam'
  | 'mockTest'
  | 'analysis'
  | 'chatbot'
  | 'insights'
  | 'leaderboard'
  | 'assignedTests'
  | 'customTest'
  | 'aiTest'
  | 'battle'
  | 'pyq'
  | 'dailyChallengeReview'
  | 'testLog'
  | 'tests'
  | 'aiCompanion'
  | 'parent'
  | 'faculty'
  | 'questionBank'
  | 'studentDetail'
  | 'createTest'
  | 'uploadQuestions'
  | 'aiGenerate'
  | 'buildTest'
  | 'verifications'
  | 'reportedQuestions'
  | 'manageTests'
  | 'admin'
  | 'users'
  | 'testApprovals'
  | 'reviewReports'
  | 'facultyReports'
  | 'messages'
  | 'contact'
  | 'settings'
  | 'comingSoon';

export type LoginRole = 'student' | 'parent' | 'faculty' | 'admin';

export interface PageDef {
  key: PageKey;
  label: string;
  group: PageGroup;
  path: string;
}

export const pages: PageDef[] = [
  { key: 'landing', label: 'Landing', group: 'Main', path: '/' },
  { key: 'login', label: 'Login', group: 'Main', path: '/login' },
  { key: 'student', label: 'Student Dashboard', group: 'Student', path: '/student' },
  { key: 'practice', label: 'Practice Module', group: 'Student', path: '/student/practice' },
  { key: 'exam', label: 'Exam Interface', group: 'Student', path: '/student/exam' },
  { key: 'mockTest', label: 'Mock Test', group: 'Student', path: '/student/mock-test' },
  { key: 'analysis', label: 'Test Analysis', group: 'Student', path: '/student/analysis' },
  { key: 'chatbot', label: 'Companion', group: 'Student', path: '/student/chatbot' },
  { key: 'insights', label: 'AI Insights', group: 'Student', path: '/student/insights' },
  { key: 'leaderboard', label: 'Leaderboard', group: 'Student', path: '/student/leaderboard' },
  { key: 'assignedTests', label: 'Assigned Tests', group: 'Student', path: '/student/assigned-tests' },
  { key: 'customTest', label: 'Custom Test', group: 'Student', path: '/student/custom-test' },
  { key: 'aiTest', label: 'AI Test', group: 'Student', path: '/student/ai-test' },
  { key: 'battle', label: 'Battle', group: 'Student', path: '/student/battle' },
  { key: 'pyq', label: 'Previous Year Papers', group: 'Student', path: '/student/pyq' },
  { key: 'dailyChallengeReview', label: 'Challenge Review', group: 'Student', path: '/student/daily-challenge/review' },
  { key: 'testLog', label: 'Test Log', group: 'Student', path: '/student/test-log' },
  { key: 'tests', label: 'Tests', group: 'Student', path: '/student/tests' },
  { key: 'aiCompanion', label: 'AI Companion', group: 'Student', path: '/student/ai-companion' },
  { key: 'parent', label: 'Parent Dashboard', group: 'Parent', path: '/parent' },
  { key: 'faculty', label: 'Faculty Dashboard', group: 'Faculty', path: '/faculty' },
  { key: 'questionBank', label: 'Question Bank', group: 'Faculty', path: '/faculty/questions' },
  { key: 'studentDetail', label: 'Student Detail', group: 'Faculty', path: '/faculty/student' },
  { key: 'createTest', label: 'Create Test', group: 'Faculty', path: '/faculty/create-test' },
  { key: 'uploadQuestions', label: 'Upload Questions', group: 'Faculty', path: '/faculty/upload-questions' },
  { key: 'aiGenerate', label: 'AI Test Generator', group: 'Faculty', path: '/faculty/ai-generate' },
  { key: 'buildTest', label: 'Build a Test', group: 'Faculty', path: '/faculty/build-test' },
  { key: 'verifications', label: 'Verifications', group: 'Faculty', path: '/faculty/verifications' },
  { key: 'reportedQuestions', label: 'Reported Questions', group: 'Faculty', path: '/faculty/reported-questions' },
  { key: 'manageTests', label: 'Manage Tests', group: 'Faculty', path: '/faculty/tests' },
  { key: 'admin', label: 'Admin Dashboard', group: 'Admin', path: '/admin' },
  { key: 'users', label: 'User Management', group: 'Admin', path: '/admin/users' },
  { key: 'testApprovals', label: 'Test Approvals', group: 'Admin', path: '/admin/test-approvals' },
  { key: 'reviewReports', label: 'Review Reports', group: 'Admin', path: '/admin/review-reports' },
  { key: 'facultyReports', label: 'Faculty AI Reports', group: 'Admin', path: '/admin/faculty-reports' },
  { key: 'messages', label: 'Messages', group: 'Main', path: '/messages' },
  { key: 'contact', label: 'Contact Us', group: 'Main', path: '/contact' },
  { key: 'settings', label: 'Settings', group: 'Main', path: '/settings' },
  { key: 'comingSoon', label: 'Coming Soon', group: 'Main', path: '/coming-soon' },
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
