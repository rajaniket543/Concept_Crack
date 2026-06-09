import type { HeatmapCellData, MetricTile, SubjectStat } from './student';

export interface GrowthPoint {
  label: string;
  percent: number;
}

export interface ReportLink {
  title: string;
  detail: string;
  icon: string;
}

export interface ActivityItem {
  title: string;
  detail: string;
  time: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'neutral';
}

export interface FacultyAlert {
  name: string;
  reason: string;
  delta: string;
}

export interface FacultyStudentRow {
  rank: number;
  name: string;
  accuracy: string;
  attendance: string;
  status: string;
}

export interface QuestionRow {
  subject: string;
  chapter: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  relevance: string;
  type: string;
}

export interface UserRow {
  name: string;
  role: 'Student' | 'Parent' | 'Faculty' | 'Admin';
  email: string;
  status: 'Active' | 'Pending' | 'Suspended';
  lastActive: string;
}

export interface InstituteRow {
  name: string;
  region: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  students: string;
  performance: string;
}

export interface HealthLogItem {
  title: string;
  detail: string;
  time: string;
}

export const parentMetrics: MetricTile[] = [
  { label: 'Current Rank', value: '#14', delta: 'Top 2% in batch', icon: 'workspace_premium', tone: 'secondary' },
  { label: 'Performance Score', value: '92%', delta: '+6% this month', icon: 'insights', tone: 'primary' },
  { label: 'Attendance', value: '98%', delta: '2 sessions missed', icon: 'calendar_month', tone: 'tertiary' },
  { label: 'Improvement', value: '+12%', delta: 'Since last review', icon: 'trending_up', tone: 'muted' },
];

export const parentGrowth: GrowthPoint[] = [
  { label: 'Aug', percent: 70 },
  { label: 'Sep', percent: 74 },
  { label: 'Oct', percent: 79 },
  { label: 'Nov', percent: 86 },
  { label: 'Dec', percent: 92 },
];

export const parentMastery: SubjectStat[] = [
  { subject: 'Physics', percent: 88, barClass: 'bg-primary' },
  { subject: 'Chemistry', percent: 94, barClass: 'bg-secondary' },
  { subject: 'Mathematics', percent: 76, barClass: 'bg-on-tertiary-container' },
];

export const parentReports: ReportLink[] = [
  { title: 'Monthly Performance Report', detail: 'PDF · 2.4 MB', icon: 'picture_as_pdf' },
  { title: 'Exam Detailed Summary', detail: 'PDF · 1.1 MB', icon: 'download' },
];

export const parentActivity: ActivityItem[] = [
  { title: 'Mock Test Completed', detail: 'Scored 84% in Physics sprint', time: 'Today', tone: 'primary' },
  { title: 'Attendance Updated', detail: 'Morning session marked present', time: 'Yesterday', tone: 'secondary' },
  { title: 'AI Suggestion', detail: 'Revise Electrostatics this evening', time: '2 days ago', tone: 'tertiary' },
];

export const facultyMetrics: MetricTile[] = [
  { label: 'Total Students', value: '1,248', delta: '+42 this month', icon: 'groups', tone: 'primary' },
  { label: 'Tests Conducted', value: '342', delta: '24 this week', icon: 'quiz', tone: 'secondary' },
  { label: 'Question Bank', value: '15.8k', delta: '1.2k AI tagged', icon: 'library_books', tone: 'tertiary' },
  { label: 'Avg Batch Accuracy', value: '78.5%', delta: '+3.1% vs last cycle', icon: 'track_changes', tone: 'muted' },
];

export const facultyTrend: GrowthPoint[] = [
  { label: 'Mon', percent: 62 },
  { label: 'Tue', percent: 68 },
  { label: 'Wed', percent: 65 },
  { label: 'Thu', percent: 74 },
  { label: 'Fri', percent: 81 },
  { label: 'Sat', percent: 78 },
];

export const facultyAlerts: FacultyAlert[] = [
  { name: 'Marco Aurelio', reason: 'Accuracy down 15% in the last two tests', delta: 'High risk' },
  { name: 'Lena Schmidt', reason: 'Consistency fell below 60% after midterms', delta: 'Needs check-in' },
  { name: 'Aanya Patel', reason: 'Skipped 3 revision slots on difficult chapters', delta: 'Review plan' },
];

export const facultyStudents: FacultyStudentRow[] = [
  { rank: 1, name: 'Riya Sharma', accuracy: '96%', attendance: '100%', status: 'Excellent' },
  { rank: 2, name: 'Dev Malhotra', accuracy: '91%', attendance: '98%', status: 'Stable' },
  { rank: 3, name: 'Marco Aurelio', accuracy: '74%', attendance: '89%', status: 'Watchlist' },
  { rank: 4, name: 'Lena Schmidt', accuracy: '72%', attendance: '87%', status: 'Watchlist' },
];

export const questionBankRows: QuestionRow[] = [
  { subject: 'Mathematics', chapter: 'Calculus III', difficulty: 'Hard', relevance: 'Numerical', type: 'JEE Main' },
  { subject: 'Chemistry', chapter: 'Chemical Bonding', difficulty: 'Easy', relevance: 'MCQ', type: 'NEET' },
  { subject: 'Physics', chapter: 'Thermodynamics', difficulty: 'Medium', relevance: 'Numerical', type: 'JEE Advanced' },
  { subject: 'Physics', chapter: 'Gravitation', difficulty: 'Easy', relevance: 'MCQ', type: 'Board' },
];

export const questionDifficulty = [
  { label: 'Easy', percent: 45, barClass: 'bg-primary-fixed-dim' },
  { label: 'Medium', percent: 35, barClass: 'bg-secondary' },
  { label: 'Hard', percent: 20, barClass: 'bg-error' },
];

export const adminMetrics: MetricTile[] = [
  { label: 'Total Institutions', value: '1,284', delta: '+18 this quarter', icon: 'apartment', tone: 'primary' },
  { label: 'Active Users', value: '42.5k', delta: 'Live sessions now', icon: 'group', tone: 'secondary' },
  { label: 'Annual Revenue', value: '$1.2M', delta: '+16% YoY', icon: 'paid', tone: 'tertiary' },
  { label: 'Active Tests', value: '8.6k', delta: 'Running today', icon: 'running_with_errors', tone: 'muted' },
];

export const topInstitutions = [
  { name: 'Oxford Coaching', region: 'North', score: '98.2', sessions: '1,248' },
  { name: 'IIT Academy', region: 'West', score: '96.8', sessions: '1,104' },
  { name: 'Legal Scholars', region: 'South', score: '95.4', sessions: '1,032' },
];

export const healthLogs: HealthLogItem[] = [
  { title: 'Backup Completed', detail: 'Database snapshot finished successfully', time: '14:10' },
  { title: 'New Institute Onboarded', detail: 'BluePeak Learning activated enterprise plan', time: '13:42' },
  { title: 'Latency Spike', detail: 'Inference latency briefly crossed 55ms', time: '12:18' },
  { title: 'Audit Passed', detail: 'Weekly security audit completed', time: '09:30' },
];

export const userMetrics: MetricTile[] = [
  { label: 'Total Users', value: '12,842', delta: '+184 this week', icon: 'groups', tone: 'primary' },
  { label: 'Active Now', value: '1,240', delta: 'Live tracking', icon: 'radio_button_checked', tone: 'secondary' },
  { label: 'Pending', value: '42', delta: 'Awaiting review', icon: 'pending_actions', tone: 'tertiary' },
  { label: 'Suspended', value: '18', delta: 'Policy review', icon: 'block', tone: 'muted' },
];

export const users: UserRow[] = [
  { name: 'Aarav Mehta', role: 'Student', email: 'aarav@example.com', status: 'Active', lastActive: '2 min ago' },
  { name: 'Priya Sharma', role: 'Student', email: 'priya@example.com', status: 'Active', lastActive: '12 min ago' },
  { name: 'Dr. R. Iyer', role: 'Faculty', email: 'riyer@example.com', status: 'Active', lastActive: 'Today' },
  { name: 'Maya Patel', role: 'Parent', email: 'maya@example.com', status: 'Pending', lastActive: 'Yesterday' },
  { name: 'Admin Desk', role: 'Admin', email: 'admin@prepmind.ai', status: 'Suspended', lastActive: '3 days ago' },
];

export const instituteMetrics: MetricTile[] = [
  { label: 'Total Institutions', value: '128', delta: 'Across 18 regions', icon: 'apartment', tone: 'primary' },
  { label: 'Total Revenue', value: '$4.2M', delta: '+22% YoY', icon: 'payments', tone: 'secondary' },
  { label: 'Total Students', value: '45,820', delta: 'Active this month', icon: 'school', tone: 'tertiary' },
  { label: 'Performance Index', value: '8.4/10', delta: 'System-wide average', icon: 'monitor_heart', tone: 'muted' },
];

export const institutes: InstituteRow[] = [
  { name: 'Delta Learning', region: 'Asia-Pacific', plan: 'Enterprise', students: '4,820', performance: '9.2' },
  { name: 'NorthStar Academy', region: 'North India', plan: 'Growth', students: '2,430', performance: '8.7' },
  { name: 'BluePeak Coaching', region: 'West India', plan: 'Starter', students: '1,120', performance: '7.9' },
  { name: 'Summit Institute', region: 'South India', plan: 'Growth', students: '3,860', performance: '8.9' },
];

export function buildHeatmapCells(rows: number, cols: number, prefix: string, palette: string[] = ['bg-primary/10', 'bg-primary/30', 'bg-primary/60', 'bg-primary']) {
  const total = rows * cols;
  return Array.from({ length: total }, (_, i): HeatmapCellData => {
    const tone = palette[i % palette.length];
    const value = (i * 17) % 100;
    return {
      topic: `${prefix} ${i + 1}`,
      percent: value < 25 ? 28 : value < 50 ? 52 : value < 75 ? 76 : 96,
      intensity: value < 25 ? 10 : value < 50 ? 30 : value < 75 ? 60 : 100,
      cellClass: tone,
    };
  });
}
