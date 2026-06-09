import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import StudentDashboard from './pages/Student/StudentDashboard';
import PracticeModule from './pages/Student/PracticeModule';
import ExamInterface from './pages/Student/ExamInterface';
import TestAnalysis from './pages/Student/TestAnalysis';
import AIAdaptiveInsights from './pages/Student/AIAdaptiveInsights';
import LeaderboardRankings from './pages/Student/LeaderboardRankings';
import ParentDashboard from './pages/Parent/ParentDashboard';
import FacultyDashboard from './pages/Faculty/FacultyDashboard';
import QuestionBankManagement from './pages/Faculty/QuestionBankManagement';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import InstituteManagement from './pages/Admin/InstituteManagement';
import { getAuthSession } from './lib/auth';
import { PageKey } from './lib/pages';

const studentNav = [
  { key: 'student' as PageKey, label: 'Dashboard', icon: 'space_dashboard' },
  { key: 'practice' as PageKey, label: 'Practice', icon: 'edit_note' },
  { key: 'exam' as PageKey, label: 'Exams', icon: 'quiz' },
  { key: 'analysis' as PageKey, label: 'Analysis', icon: 'analytics' },
  { key: 'insights' as PageKey, label: 'AI Insights', icon: 'auto_awesome' },
  { key: 'leaderboard' as PageKey, label: 'Leaderboard', icon: 'leaderboard' },
];

const parentNav = [
  { key: 'parent' as PageKey, label: 'Child Overview', icon: 'family_restroom' },
  { key: 'student' as PageKey, label: 'Student View', icon: 'school' },
];

const facultyNav = [
  { key: 'faculty' as PageKey, label: 'Dashboard', icon: 'space_dashboard' },
  { key: 'questionBank' as PageKey, label: 'Question Bank', icon: 'library_books' },
  { key: 'student' as PageKey, label: 'Student View', icon: 'school' },
];

const adminNav = [
  { key: 'admin' as PageKey, label: 'Dashboard', icon: 'space_dashboard' },
  { key: 'users' as PageKey, label: 'Users', icon: 'group' },
  { key: 'institutes' as PageKey, label: 'Institutes', icon: 'apartment' },
  { key: 'faculty' as PageKey, label: 'Faculty View', icon: 'co_present' },
];

function StudentLayout() {
  return <Layout brand="Student Portal" nav={studentNav} />;
}
function ExamLayout() {
  return <Layout brand="Student Portal" nav={studentNav} variant="focus" />;
}
function ParentLayout() {
  return <Layout brand="Parent Portal" nav={parentNav} />;
}
function FacultyLayout() {
  return <Layout brand="Faculty Portal" nav={facultyNav} />;
}
function AdminLayout() {
  return <Layout brand="Admin Portal" nav={adminNav} />;
}

function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Array<'student' | 'parent' | 'faculty' | 'admin'>;
}) {
  const session = getAuthSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(session.user.role)) {
    return <Navigate to={session.redirectTo} replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<RequireAuth><StudentDashboard /></RequireAuth>} />
          <Route path="practice" element={<RequireAuth><PracticeModule /></RequireAuth>} />
          <Route path="analysis" element={<RequireAuth><TestAnalysis /></RequireAuth>} />
          <Route path="insights" element={<RequireAuth><AIAdaptiveInsights /></RequireAuth>} />
          <Route path="leaderboard" element={<RequireAuth><LeaderboardRankings /></RequireAuth>} />
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
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
          <Route path="users" element={<RequireAuth roles={['admin']}><UserManagement /></RequireAuth>} />
          <Route path="institutes" element={<RequireAuth roles={['admin']}><InstituteManagement /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
