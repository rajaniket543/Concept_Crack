import { hashPassword } from './security';
import {
  analysis,
  aiRecommendations,
  currentStudent,
  dashboardMetrics,
  examMeta,
  genExamQuestions,
  genInsightsHeatmap,
  heatmapCells,
  insightsProfile,
  leaderboard,
  practiceModules,
  revisionPriorities,
  subjectPerformance,
  weeklyProgress,
  weakAreas,
} from '../src/mocks/student';
import {
  adminMetrics,
  facultyAlerts,
  facultyMetrics,
  facultyStudents,
  facultyTrend,
  healthLogs,
  instituteMetrics,
  institutes,
  parentActivity,
  parentGrowth,
  parentMastery,
  parentMetrics,
  parentReports,
  questionBankRows,
  questionDifficulty,
  topInstitutions,
  userMetrics,
  users,
} from '../src/mocks/portal';

export type Role = 'student' | 'parent' | 'faculty' | 'admin';

export type PortalMethod = 'email' | 'mobile' | 'otp';

export type UserStatus = 'Active' | 'Pending' | 'Suspended';

export interface DemoAccount {
  id: string;
  name: string;
  role: Role;
  email: string;
  mobile: string;
  status: UserStatus;
  lastActive: string;
  passwordSalt: string;
  passwordHash: string;
  permissions: string[];
}

export interface DirectoryUser {
  id: string;
  name: string;
  role: Role;
  email: string;
  mobile: string;
  status: UserStatus;
  lastActive: string;
  institute: string;
  batch: string;
}

export const rolePermissions: Record<Role, string[]> = {
  student: ['student:read', 'student:submit-exam', 'student:practice'],
  parent: ['parent:read'],
  faculty: ['faculty:read', 'question-bank:read', 'question-bank:write', 'tests:write'],
  admin: ['admin:read', 'users:write', 'institutes:write', 'logs:read'],
};

const demoPasswords: Record<Role, string> = {
  student: 'Student@123',
  parent: 'Parent@123',
  faculty: 'Faculty@123',
  admin: 'Admin@123',
};

function makeDemoAccount(role: Role, name: string, email: string, mobile: string, id: string): DemoAccount {
  const { salt, hash } = hashPassword(demoPasswords[role]);
  return {
    id,
    name,
    role,
    email,
    mobile,
    status: 'Active',
    lastActive: 'Just now',
    passwordSalt: salt,
    passwordHash: hash,
    permissions: rolePermissions[role],
  };
}

const studentDirectoryNames = [
  'Aarav Mehta',
  'Priya Sharma',
  'Rohan Verma',
  'Anaya Iyer',
  'Kabir Singh',
  'Meera Nair',
  'Arjun Patel',
  'Isha Gupta',
  'Dev Malhotra',
  'Nisha Rao',
];

function buildDirectoryUsers(count = 200): DirectoryUser[] {
  return Array.from({ length: count }, (_, index) => {
    const name = studentDirectoryNames[index % studentDirectoryNames.length];
    const serial = String(index + 1).padStart(3, '0');
    const institute = ['BluePeak Coaching', 'NorthStar Academy', 'Summit Institute', 'Delta Learning'][index % 4];
    const batch = `A-${String((index % 6) + 1).padStart(2, '0')}`;
    const status: UserStatus = index % 17 === 0 ? 'Pending' : index % 29 === 0 ? 'Suspended' : 'Active';
    return {
      id: `STU-${serial}`,
      name: `${name} ${index >= studentDirectoryNames.length ? `#${index + 1}` : ''}`.trim(),
      role: 'student',
      email: `student${serial}@prepmind.ai`,
      mobile: `+91 90000 ${String(1000 + index).slice(-4)}`,
      status,
      lastActive: index % 3 === 0 ? '2 min ago' : index % 3 === 1 ? 'Today' : 'Yesterday',
      institute,
      batch,
    };
  });
}

export const demoAccounts: DemoAccount[] = [
  makeDemoAccount('student', currentStudent.name, 'student@prepmind.ai', '+91 90000 00001', currentStudent.id),
  makeDemoAccount('parent', 'Maya Verma', 'parent@prepmind.ai', '+91 90000 00002', 'PRT-1001'),
  makeDemoAccount('faculty', 'Dr. R. Iyer', 'faculty@prepmind.ai', '+91 90000 00003', 'FAC-1001'),
  makeDemoAccount('admin', 'Admin Desk', 'admin@prepmind.ai', '+91 90000 00004', 'ADM-1001'),
];

export const userDirectory = [
  ...buildDirectoryUsers(200),
  {
    id: currentStudent.id,
    name: currentStudent.name,
    role: 'student' as const,
    email: 'student@prepmind.ai',
    mobile: '+91 90000 00001',
    status: 'Active' as const,
    lastActive: 'Just now',
    institute: 'NorthStar Academy',
    batch: 'A-12',
  },
];

export const seedQuestions = genExamQuestions(examMeta.totalQuestions).map((question) => ({
  ...question,
  correctKey: (['A', 'B', 'C', 'D'][(question.id * 7) % 4] ?? 'A') as 'A' | 'B' | 'C' | 'D',
}));

export const seed = {
  currentStudent,
  dashboardMetrics,
  subjectPerformance,
  weeklyProgress,
  heatmapCells,
  weakAreas,
  aiRecommendations,
  practiceModules,
  examMeta,
  seedQuestions,
  analysis,
  leaderboard,
  insightsProfile,
  revisionPriorities,
  genInsightsHeatmap,
  parentMetrics,
  parentGrowth,
  parentMastery,
  parentReports,
  parentActivity,
  facultyMetrics,
  facultyTrend,
  facultyAlerts,
  facultyStudents,
  questionBankRows,
  questionDifficulty,
  adminMetrics,
  topInstitutions,
  healthLogs,
  userMetrics,
  users,
  instituteMetrics,
  institutes,
  demoAccounts,
  userDirectory,
};

