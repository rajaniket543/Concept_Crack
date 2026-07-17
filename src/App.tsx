import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import RouteProgress from './components/RouteProgress';
import ActivityTracker from './components/ActivityTracker';
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
import MockTest from './pages/Student/MockTest';
import TestLog from './pages/Student/TestLog';
import ParentDashboard from './pages/Parent/ParentDashboard';
import FacultyDashboard from './pages/Faculty/FacultyDashboard';
import QuestionBankManagement from './pages/Faculty/QuestionBankManagement';
import StudentDetail from './pages/Faculty/StudentDetail';
import CreateTest from './pages/Faculty/CreateTest';
import UploadQuestions from './pages/Faculty/UploadQuestions';
import AIGenerateTest from './pages/Faculty/AIGenerateTest';
import ManualTestBuilder from './pages/Faculty/ManualTestBuilder';
import TestVerification from './pages/Faculty/TestVerification';
import ManageTests from './pages/Faculty/ManageTests';
import TestChatBot from './pages/Student/TestChatBot';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import TestApprovals from './pages/Admin/TestApprovals';
import ReviewReports from './pages/Admin/ReviewReports';
import FacultyReports from './pages/Admin/FacultyReports';
import Messages from './pages/Messages';
import ContactUs from './pages/ContactUs';
import Settings from './pages/Settings';
import ChangePassword from './pages/ChangePassword';
import { getAuthSession } from './lib/auth';
import { PageKey } from './lib/pages';

// ─── Nav definitions using sectioned format ─────────────────────────────────
// The "Account" section is pinned to the bottom of the sidebar in every portal.

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
      { key: 'mockTest' as PageKey,   label: 'Mock Test',   icon: 'quiz' },
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
      { key: 'testLog' as PageKey,    label: 'Review Tests',  icon: 'history_edu' },
      { key: 'insights' as PageKey,   label: 'AI Insights',   icon: 'psychology' },
      { key: 'leaderboard' as PageKey,label: 'Leaderboard',   icon: 'leaderboard' },
    ],
  },
  {
    label: 'Connect',
    items: [
      { key: 'messages' as PageKey,   label: 'Messages',      icon: 'chat' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'contact' as PageKey,    label: 'Contact Us',    icon: 'support_agent' },
      { key: 'settings' as PageKey,   label: 'Settings',      icon: 'settings' },
    ],
  },
];

const parentNav = [
  {
    items: [
      { key: 'parent' as PageKey,   label: 'Overview',      icon: 'family_restroom' },
      { key: 'messages' as PageKey, label: 'Messages',      icon: 'chat' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'contact' as PageKey,  label: 'Contact Us',    icon: 'support_agent' },
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
      { key: 'createTest' as PageKey,   label: 'Create Test',      icon: 'add_circle' },
      { key: 'manageTests' as PageKey,  label: 'My Tests',         icon: 'quiz' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { key: 'questionBank' as PageKey,    label: 'Question Bank',   icon: 'library_books' },
      { key: 'uploadQuestions' as PageKey, label: 'Upload Questions', icon: 'upload_file' },
      { key: 'verifications' as PageKey,   label: 'Verifications',   icon: 'fact_check' },
      { key: 'messages' as PageKey,        label: 'Messages',        icon: 'chat' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'contact' as PageKey,      label: 'Contact Us',     icon: 'support_agent' },
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
      { key: 'users' as PageKey,          label: 'Users',              icon: 'group' },
      { key: 'testApprovals' as PageKey,  label: 'Test Approvals',     icon: 'verified' },
      { key: 'reviewReports' as PageKey,  label: 'Review Reports',     icon: 'fact_check' },
      { key: 'facultyReports' as PageKey, label: 'Faculty AI Reports', icon: 'summarize' },
      { key: 'messages' as PageKey,       label: 'Messages',           icon: 'chat' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'contact' as PageKey,      label: 'Contact Us',      icon: 'support_agent' },
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

// Shared pages (Messages, Settings, Contact) render inside whichever portal the
// signed-in user belongs to, so the sidebar stays visible instead of opening a
// bare full-window page.
const SHARED_LAYOUT: Record<string, { brand: string; nav: typeof studentNav }> = {
  student: { brand: 'Student Portal', nav: studentNav },
  parent:  { brand: 'Parent Portal',  nav: parentNav },
  faculty: { brand: 'Faculty Portal', nav: facultyNav },
  admin:   { brand: 'Admin Portal',   nav: adminNav },
};
function SharedLayout() {
  const session = getAuthSession();
  const role = (session?.user?.role ?? 'student') as 'student' | 'parent' | 'faculty' | 'admin';
  const cfg = SHARED_LAYOUT[role] ?? SHARED_LAYOUT.student;
  return <Layout brand={cfg.brand} role={role} nav={cfg.nav} />;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Array<'student' | 'parent' | 'faculty' | 'admin'>;
}) {
  const location = useLocation();
  const session = getAuthSession();
  if (!session) return <Navigate to="/login" replace />;

  // A forced password change blocks every protected page — regardless of role
  // or which URL was typed in directly — until it's completed. The Change
  // Password route itself is exempt so this can never become a redirect loop.
  if (session.user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && !roles.includes(session.user.role)) return <Navigate to={session.redirectTo} replace />;
  return children;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <RouteProgress />
      <ActivityTracker />
      <Routes>
      <Route path="/" element={<Navigate to="/about" replace />} />
      <Route path="/about" element={<Landing />} />
      <Route path="/login" element={<Login />} />

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
        <Route path="mock-test" element={<RequireAuth roles={['student']}><MockTest /></RequireAuth>} />
        <Route path="test-log" element={<RequireAuth roles={['student']}><TestLog /></RequireAuth>} />
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
        <Route path="upload-questions" element={<RequireAuth roles={['faculty', 'admin']}><UploadQuestions /></RequireAuth>} />
        <Route path="ai-generate" element={<RequireAuth roles={['faculty', 'admin']}><AIGenerateTest /></RequireAuth>} />
        <Route path="build-test" element={<RequireAuth roles={['faculty', 'admin']}><ManualTestBuilder /></RequireAuth>} />
        <Route path="verifications" element={<RequireAuth roles={['faculty', 'admin']}><TestVerification /></RequireAuth>} />
        <Route path="tests" element={<RequireAuth roles={['faculty', 'admin']}><ManageTests /></RequireAuth>} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="users" element={<RequireAuth roles={['admin']}><UserManagement /></RequireAuth>} />
        <Route path="test-approvals" element={<RequireAuth roles={['admin']}><TestApprovals /></RequireAuth>} />
        <Route path="review-reports" element={<RequireAuth roles={['admin']}><ReviewReports /></RequireAuth>} />
        <Route path="faculty-reports" element={<RequireAuth roles={['admin']}><FacultyReports /></RequireAuth>} />
      </Route>

      <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />

      {/* Shared pages nested inside the role's portal shell (sidebar stays) */}
      <Route element={<RequireAuth><SharedLayout /></RequireAuth>}>
        <Route path="/messages" element={<Messages />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
