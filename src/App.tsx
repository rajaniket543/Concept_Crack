import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import RouteProgress from './components/RouteProgress';
import Landing from './pages/Landing';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import StudentDashboard from './pages/Student/StudentDashboard';
import PracticeModule from './pages/Student/PracticeModule';
import ExamInterface from './pages/Student/ExamInterface';
import TestAnalysis from './pages/Student/TestAnalysis';
import AIAdaptiveInsights from './pages/Student/AIAdaptiveInsights';
import LeaderboardRankings from './pages/Student/LeaderboardRankings';
import AssignedTests from './pages/Student/AssignedTests';
import CustomTest from './pages/Student/CustomTest';
import AITest from './pages/Student/AITest';
import Battle from './pages/Student/Battle';
import ParentDashboard from './pages/Parent/ParentDashboard';
import FacultyDashboard from './pages/Faculty/FacultyDashboard';
import QuestionBankManagement from './pages/Faculty/QuestionBankManagement';
import StudentDetail from './pages/Faculty/StudentDetail';
import CreateTest from './pages/Faculty/CreateTest';
import ManageTests from './pages/Faculty/ManageTests';
import StreamSelect from './pages/StreamSelect';
import TestChatBot from './pages/Student/TestChatBot';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import InstituteManagement from './pages/Admin/InstituteManagement';
import TestApprovals from './pages/Admin/TestApprovals';
import Settings from './pages/Settings';
import { getAuthSession } from './lib/auth';
import { PageKey } from './lib/pages';

// ─── Nav definitions using sectioned format ─────────────────────────────────

const studentNav = [
  {
    items: [
      { key: 'student' as PageKey,    label: 'Dashboard',   icon: 'space_dashboard' },
    ],
  },
  {
    label: 'Learn',
    items: [
      { key: 'practice' as PageKey,   label: 'Practice',    icon: 'edit_note' },
      { key: 'exam' as PageKey,       label: 'Mock Tests',  icon: 'quiz' },
    ],
  },
  {
    label: 'Tests',
    items: [
      { key: 'assignedTests' as PageKey, label: 'Assigned Tests', icon: 'assignment' },
      { key: 'customTest' as PageKey,    label: 'Custom Test',    icon: 'tune' },
      { key: 'aiTest' as PageKey,        label: 'AI Test',        icon: 'auto_awesome' },
      { key: 'battle' as PageKey,        label: 'Battle',         icon: 'sports_esports' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { key: 'analysis' as PageKey,   label: 'Test Analysis', icon: 'analytics' },
      { key: 'insights' as PageKey,   label: 'AI Insights',   icon: 'psychology' },
      { key: 'leaderboard' as PageKey,label: 'Leaderboard',   icon: 'leaderboard' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'settings' as PageKey,   label: 'Settings',      icon: 'settings' },
    ],
  },
];

const parentNav = [
  {
    items: [
      { key: 'parent' as PageKey,   label: 'Overview',      icon: 'family_restroom' },
      { key: 'student' as PageKey,  label: 'Student View',  icon: 'school' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'settings' as PageKey, label: 'Settings',      icon: 'settings' },
    ],
  },
];

const facultyNav = [
  {
    items: [
      { key: 'faculty' as PageKey,      label: 'Dashboard',     icon: 'space_dashboard' },
    ],
  },
  {
    label: 'Tests',
    items: [
      { key: 'createTest' as PageKey,   label: 'Create Test',    icon: 'add_circle' },
      { key: 'manageTests' as PageKey,  label: 'My Tests',       icon: 'quiz' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { key: 'questionBank' as PageKey, label: 'Question Bank',  icon: 'library_books' },
      { key: 'student' as PageKey,      label: 'Student View',   icon: 'school' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'settings' as PageKey,     label: 'Settings',       icon: 'settings' },
    ],
  },
];

const adminNav = [
  {
    items: [
      { key: 'admin' as PageKey,      label: 'Dashboard',  icon: 'space_dashboard' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { key: 'users' as PageKey,        label: 'Users',           icon: 'group' },
      { key: 'institutes' as PageKey,   label: 'Institutes',      icon: 'apartment' },
      { key: 'faculty' as PageKey,      label: 'Faculty',         icon: 'co_present' },
      { key: 'testApprovals' as PageKey,label: 'Test Approvals',  icon: 'verified' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'settings' as PageKey,     label: 'Settings',        icon: 'settings' },
    ],
  },
];

// ─── Layout wrappers ──────────────────────────────────────────────────────────

function StudentLayout() {
  return <Layout brand="Student Portal" role="student" nav={studentNav} />;
}
function ExamLayout() {
  return <Layout brand="Student Portal" role="student" nav={studentNav} variant="focus" />;
}
function ParentLayout() {
  return <Layout brand="Parent Portal" role="parent" nav={parentNav} />;
}
function FacultyLayout() {
  return <Layout brand="Faculty Portal" role="faculty" nav={facultyNav} />;
}
function AdminLayout() {
  return <Layout brand="Admin Portal" role="admin" nav={adminNav} />;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Array<'student' | 'parent' | 'faculty' | 'admin'>;
}) {
  const session = getAuthSession();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(session.user.role)) return <Navigate to={session.redirectTo} replace />;
  return children;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <RouteProgress />
      <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/about" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route path="/student/select-stream" element={<RequireAuth roles={['student']}><StreamSelect /></RequireAuth>} />
      <Route path="/student/chatbot" element={<RequireAuth roles={['student']}><TestChatBot /></RequireAuth>} />

      <Route path="/student" element={<StudentLayout />}>
        <Route index element={<RequireAuth><StudentDashboard /></RequireAuth>} />
        <Route path="practice" element={<RequireAuth><PracticeModule /></RequireAuth>} />
        <Route path="analysis" element={<RequireAuth><TestAnalysis /></RequireAuth>} />
        <Route path="insights" element={<RequireAuth><AIAdaptiveInsights /></RequireAuth>} />
        <Route path="leaderboard" element={<RequireAuth><LeaderboardRankings /></RequireAuth>} />
        <Route path="assigned-tests" element={<RequireAuth roles={['student']}><AssignedTests /></RequireAuth>} />
        <Route path="custom-test" element={<RequireAuth roles={['student']}><CustomTest /></RequireAuth>} />
        <Route path="ai-test" element={<RequireAuth roles={['student']}><AITest /></RequireAuth>} />
        <Route path="battle" element={<RequireAuth roles={['student']}><Battle /></RequireAuth>} />
      </Route>

      <Route path="/student/exam" element={<ExamLayout />}>
        <Route index element={<RequireAuth roles={['student']}><ExamInterface /></RequireAuth>} />
      </Route>

      <Route path="/parent" element={<ParentLayout />}>
        <Route index element={<RequireAuth roles={['parent']}><ParentDashboard /></RequireAuth>} />
      </Route>

      <Route path="/faculty" element={<FacultyLayout />}>
        <Route index element={<RequireAuth roles={['faculty', 'admin']}><FacultyDashboard /></RequireAuth>} />
        <Route path="questions" element={<RequireAuth roles={['faculty', 'admin']}><QuestionBankManagement /></RequireAuth>} />
        <Route path="student/:studentId" element={<RequireAuth roles={['faculty', 'admin']}><StudentDetail /></RequireAuth>} />
        <Route path="create-test" element={<RequireAuth roles={['faculty', 'admin']}><CreateTest /></RequireAuth>} />
        <Route path="tests" element={<RequireAuth roles={['faculty', 'admin']}><ManageTests /></RequireAuth>} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="users" element={<RequireAuth roles={['admin']}><UserManagement /></RequireAuth>} />
        <Route path="institutes" element={<RequireAuth roles={['admin']}><InstituteManagement /></RequireAuth>} />
        <Route path="test-approvals" element={<RequireAuth roles={['admin']}><TestApprovals /></RequireAuth>} />
      </Route>

      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />

      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
