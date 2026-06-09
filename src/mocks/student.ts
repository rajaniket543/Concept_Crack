// Mock data layer for the Student portal. All types + data in one module so the
// 6 Student screens can import exactly what they need without cross-file seeds.

export type Subject =
  | 'Mathematics'
  | 'Physics'
  | 'Chemistry'
  | 'English'
  | 'Biology';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type PracticeBadge = 'Hard' | 'Medium' | 'Easy' | 'PYQ' | 'AI Pick';

export interface Student {
  id: string;
  name: string;
  grade: string;
  initials: string;
}

export interface MetricTile {
  label: string;
  value: string;
  delta?: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'warning' | 'muted';
  progressPct?: number;
}

export interface SubjectStat {
  subject: Subject;
  percent: number;
  barClass: string;
}

export interface WeeklyDay {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  percent: number;
}

export interface HeatmapCellData {
  topic: string;
  percent: number;
  intensity: 10 | 30 | 60 | 100;
  cellClass: string;
}

export interface WeakArea {
  name: string;
  percent: number;
  note: string;
}

export interface AIRecommendation {
  title: string;
  rationale: string;
  durationMins: number;
  icon: string;
}

export interface PracticeModuleItem {
  id: string;
  title: string;
  subject: Subject;
  icon: string;
  difficulty: Difficulty;
  badges: PracticeBadge[];
  questions: number;
  minutes: number;
  progress: number;
  status: 'start' | 'review' | 'completed';
}

export interface ExamMeta {
  id: string;
  title: string;
  totalQuestions: number;
  currentIndex: number;
  durationSeconds: number;
  candidateId: string;
}

export interface ExamOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface ExamQuestion {
  id: number;
  prompt: string;
  options: ExamOption[];
  difficulty: Difficulty;
  section: string;
}

export interface AnalysisTopicRow {
  topic: string;
  yours: number;
  groupAvg: number;
}

export interface DifficultyRow {
  level: Difficulty;
  solved: number;
  total: number;
  barClass: string;
}

export interface LeaderRow {
  rank: number;
  name: string;
  points?: number;
  accuracy?: number;
  timePerAvg?: string;
  deltaPct: number;
  isCurrentUser?: boolean;
  highlight?: 'gold' | 'silver' | 'bronze' | 'none';
  badge?: string;
  avatarUrl?: string;
}

export interface PodiumEntry {
  rank: 1 | 2 | 3;
  name: string;
  points: number;
  avatarUrl: string;
  tone: 'gold' | 'silver' | 'bronze';
  delay: number;
}

export interface UserPerformance {
  rank: number;
  outOf: number;
  masteryPct: number;
  streakDays: number;
  percentile: string;
}

export interface InsightsMetric {
  label: string;
  percent: number;
  tone: 'primary' | 'secondary' | 'tertiary';
  caption: string;
}

export interface RevisionItem {
  name: string;
  status: 'AI Recommended' | 'High Impact' | 'Suggested';
  statusClass: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  note: string;
}

export interface InsightsHeatmapCell {
  module: string;
  score: number;
  trend: 'up' | 'down' | 'flat';
  intensity: 10 | 30 | 50 | 70 | 90 | 100;
  cellClass: string;
}

// ---------- Data ----------

export const currentStudent: Student = {
  id: 'PM7721',
  name: 'John Doe',
  grade: 'Grade 12 · Science',
  initials: 'JD',
};

export const dashboardMetrics: MetricTile[] = [
  {
    label: 'Performance Score',
    value: '85%',
    delta: '+3% vs last week',
    icon: 'insights',
    tone: 'primary',
  },
  {
    label: 'Current Rank',
    value: '#42',
    delta: 'Top 5% Institutional',
    icon: 'workspace_premium',
    tone: 'secondary',
  },
  {
    label: 'Accuracy',
    value: '92%',
    icon: 'target',
    tone: 'tertiary',
    progressPct: 92,
  },
  {
    label: 'Practice Time',
    value: '12h',
    delta: 'Per week average',
    icon: 'timer',
    tone: 'muted',
  },
];

export const subjectPerformance: SubjectStat[] = [
  { subject: 'Mathematics', percent: 94, barClass: 'bg-primary' },
  { subject: 'Physics', percent: 78, barClass: 'bg-secondary' },
  { subject: 'Chemistry', percent: 85, barClass: 'bg-on-tertiary-container' },
  { subject: 'English', percent: 92, barClass: 'bg-primary-container' },
];

export const weeklyProgress: WeeklyDay[] = [
  { day: 'Mon', percent: 65 },
  { day: 'Tue', percent: 72 },
  { day: 'Wed', percent: 68 },
  { day: 'Thu', percent: 88 },
  { day: 'Fri', percent: 92 },
  { day: 'Sat', percent: 75 },
  { day: 'Sun', percent: 94 },
];

// The static mock hand-paints 24 cells with specific intensity classes; replicate.
const HEATMAP_INTENSITIES: Array<10 | 30 | 60 | 100> = [100, 60, 30, 10, 60, 100, 100, 30, 10, 60, 100, 30, 10, 30, 60, 100, 10, 30, 60, 100, 10, 30, 60, 100];
const HEATMAP_INTENSITY_CLASS: Record<10 | 30 | 60 | 100, string> = {
  10: 'bg-primary/10',
  30: 'bg-primary/30',
  60: 'bg-primary/60',
  100: 'bg-primary',
};
const TOPIC_LABELS = [
  'Calculus', 'Linear Algebra', 'Probability', 'Logic',
  'Mechanics', 'Thermodynamics', 'Optics', 'Waves',
  'Organic', 'Inorganic', 'Trigonometry', 'Vectors',
];

export const heatmapCells: HeatmapCellData[] = HEATMAP_INTENSITIES.map((intensity, i) => ({
  topic: TOPIC_LABELS[i % TOPIC_LABELS.length],
  percent: intensity === 100 ? 98 : intensity === 60 ? 76 : intensity === 30 ? 54 : 32,
  intensity,
  cellClass: HEATMAP_INTENSITY_CLASS[intensity],
}));

export const weakAreas: WeakArea[] = [
  { name: 'Organic Synthesis', percent: 62, note: 'Last practiced 4 days ago' },
  { name: 'Circular Motion', percent: 58, note: 'Accuracy dropped by 12%' },
  { name: 'Wave Optics', percent: 65, note: 'Focus required on interference' },
];

export const aiRecommendations: AIRecommendation[] = [
  {
    title: 'Revise Quadratic Equations',
    rationale: 'Found 4 key misconceptions in your last quiz.',
    durationMins: 15,
    icon: 'auto_awesome',
  },
  {
    title: "Master Newton's Laws",
    rationale: 'Suggested based on your upcoming Physics Mock.',
    durationMins: 25,
    icon: 'auto_awesome',
  },
];

// Practice module cards — the static mock hand-paints 3 topic rows.
export const practiceModules: PracticeModuleItem[] = [
  {
    id: 'wave-optics',
    title: 'Wave Optics & Interference',
    subject: 'Physics',
    icon: 'waves',
    difficulty: 'Hard',
    badges: ['Hard', 'PYQ'],
    questions: 45,
    minutes: 90,
    progress: 65,
    status: 'start',
  },
  {
    id: 'electrostatic',
    title: 'Electrostatic Potential',
    subject: 'Physics',
    icon: 'lightbulb',
    difficulty: 'Medium',
    badges: ['Medium', 'AI Pick'],
    questions: 32,
    minutes: 60,
    progress: 0,
    status: 'start',
  },
  {
    id: 'kinematics',
    title: 'Kinematics: 2D Motion',
    subject: 'Physics',
    icon: 'architecture',
    difficulty: 'Easy',
    badges: ['Easy'],
    questions: 24,
    minutes: 45,
    progress: 100,
    status: 'completed',
  },
];

export const examMeta: ExamMeta = {
  id: 'PM-992-AX',
  title: 'Advanced Cognitive Psychology Exam',
  totalQuestions: 50,
  currentIndex: 14,
  durationSeconds: 59 * 60 + 42,
  candidateId: 'PM7721',
};

// Q14 is fully fleshed out in the static mock. The other 49 are deterministic
// placeholders generated from a seeded function so layout is stable across renders.
const PLACEHOLDER_PROMPTS: Array<{ prompt: string; options: ExamOption[]; difficulty: Difficulty; section: string }> = [
  {
    prompt: 'Which schedule of reinforcement produces the highest rate of responding under steady-state conditions?',
    options: [
      { key: 'A', text: 'Fixed Ratio (FR-1)' },
      { key: 'B', text: 'Variable Ratio (VR-10)' },
      { key: 'C', text: 'Fixed Interval (FI-30s)' },
      { key: 'D', text: 'Variable Interval (VI-60s)' },
    ],
    difficulty: 'Medium',
    section: 'Section A: Learning Theory',
  },
  {
    prompt: 'In a within-subjects design, counterbalancing primarily controls for:',
    options: [
      { key: 'A', text: 'Individual differences' },
      { key: 'B', text: 'Order effects' },
      { key: 'C', text: 'Experimenter bias' },
      { key: 'D', text: 'Selection bias' },
    ],
    difficulty: 'Easy',
    section: 'Section A: Research Methods',
  },
  {
    prompt: 'Which brain structure is most directly implicated in the consolidation of declarative memories?',
    options: [
      { key: 'A', text: 'Amygdala' },
      { key: 'B', text: 'Cerebellum' },
      { key: 'C', text: 'Hippocampus' },
      { key: 'D', text: 'Basal Ganglia' },
    ],
    difficulty: 'Medium',
    section: 'Section B: Cognitive Bias',
  },
  {
    prompt: 'The Stroop effect is best explained as a failure of:',
    options: [
      { key: 'A', text: 'Selective attention' },
      { key: 'B', text: 'Perceptual encoding' },
      { key: 'C', text: 'Long-term retrieval' },
      { key: 'D', text: 'Motor preparation' },
    ],
    difficulty: 'Hard',
    section: 'Section B: Cognitive Bias',
  },
  {
    prompt: 'Which level of processing produces the deepest encoding?',
    options: [
      { key: 'A', text: 'Structural' },
      { key: 'B', text: 'Phonemic' },
      { key: 'C', text: 'Semantic' },
      { key: 'D', text: 'Graphemic' },
    ],
    difficulty: 'Easy',
    section: 'Section A: Memory',
  },
  {
    prompt: 'Pavlovian conditioning requires which of the following to occur before a conditioned response is observed?',
    options: [
      { key: 'A', text: 'Continuous reinforcement' },
      { key: 'B', text: 'Contiguity and contingency' },
      { key: 'C', text: 'Extinction trials' },
      { key: 'D', text: 'Spontaneous recovery' },
    ],
    difficulty: 'Medium',
    section: 'Section A: Learning Theory',
  },
  {
    prompt: 'Signal detection theory separates sensitivity from response bias using:',
    options: [
      { key: 'A', text: 'Hit and false-alarm rates' },
      { key: 'B', text: 'Mean reaction times' },
      { key: 'C', text: 'Recognition memory scores' },
      { key: 'D', text: 'Skin conductance responses' },
    ],
    difficulty: 'Hard',
    section: 'Section C: Perception',
  },
  {
    prompt: 'The "cocktail party effect" is most often cited as evidence for:',
    options: [
      { key: 'A', text: 'Divided attention' },
      { key: 'B', text: 'Late selection' },
      { key: 'C', text: 'Inattentional blindness' },
      { key: 'D', text: 'Change blindness' },
    ],
    difficulty: 'Medium',
    section: 'Section B: Cognitive Bias',
  },
  {
    prompt: 'Which heuristic produces systematic overestimation of event likelihood based on ease of recall?',
    options: [
      { key: 'A', text: 'Anchoring' },
      { key: 'B', text: 'Availability' },
      { key: 'C', text: 'Representativeness' },
      { key: 'D', text: 'Framing' },
    ],
    difficulty: 'Easy',
    section: 'Section B: Cognitive Bias',
  },
  {
    prompt: 'Working memory is best characterized as a system for:',
    options: [
      { key: 'A', text: 'Permanent knowledge storage' },
      { key: 'B', text: 'Brief maintenance and manipulation of information' },
      { key: 'C', text: 'Unconscious procedural learning' },
      { key: 'D', text: 'Emotional memory consolidation' },
    ],
    difficulty: 'Medium',
    section: 'Section A: Memory',
  },
  {
    prompt: 'The "fundamental attribution error" refers to the tendency to:',
    options: [
      { key: 'A', text: 'Overestimate situational factors in others\' behavior' },
      { key: 'B', text: 'Underestimate dispositional factors in our own behavior' },
      { key: 'C', text: 'Overestimate dispositional factors in others\' behavior' },
      { key: 'D', text: 'Equally weight all attributions' },
    ],
    difficulty: 'Medium',
    section: 'Section D: Social Cognition',
  },
  {
    prompt: 'A double-blind procedure controls for which of the following threats to validity?',
    options: [
      { key: 'A', text: 'Selection effects' },
      { key: 'B', text: 'Maturation' },
      { key: 'C', text: 'Experimenter and participant expectancies' },
      { key: 'D', text: 'Regression to the mean' },
    ],
    difficulty: 'Hard',
    section: 'Section A: Research Methods',
  },
  {
    prompt: 'REM sleep is most strongly associated with:',
    options: [
      { key: 'A', text: 'Motor restoration' },
      { key: 'B', text: 'Emotional memory processing' },
      { key: 'C', text: 'Glycogen replenishment' },
      { key: 'D', text: 'Growth-hormone release' },
    ],
    difficulty: 'Medium',
    section: 'Section E: Biological Bases',
  },
];

function makePlaceholderQuestion(id: number, slot: number): ExamQuestion {
  const template = PLACEHOLDER_PROMPTS[slot % PLACEHOLDER_PROMPTS.length];
  return { id, ...template };
}

export function genExamQuestions(total: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 14) {
      out.push({
        id: 14,
        prompt:
          'Based on the neural imaging result below, which region of the prefrontal cortex shows the highest metabolic activation when the subject is presented with an ambiguous moral dilemma?',
        options: [
          { key: 'A', text: 'Dorsolateral Prefrontal Cortex (dlPFC)' },
          { key: 'B', text: 'Ventromedial Prefrontal Cortex (vmPFC)' },
          { key: 'C', text: 'Anterior Cingulate Cortex (ACC)' },
          { key: 'D', text: 'Orbitofrontal Cortex (OFC)' },
        ],
        difficulty: 'Medium',
        section: 'Section B: Cognitive Bias',
      });
    } else {
      out.push(makePlaceholderQuestion(i, i));
    }
  }
  return out;
}

export const analysis = {
  totalScore: 150,
  totalPossible: 200,
  totalPct: 75,
  rank: 12,
  totalStudents: 2400,
  rankPercentile: 5,
  accuracyPct: 88,
  correctCount: 44,
  incorrectCount: 4,
  skippedCount: 2,
  timeMinutes: 42,
  timeVsAvgMinutes: 12,
  topicPerformance: [
    { topic: 'Algebra', yours: 95, groupAvg: 72 },
    { topic: 'Geometry', yours: 82, groupAvg: 68 },
    { topic: 'Calculus', yours: 65, groupAvg: 55 },
    { topic: 'Probability', yours: 88, groupAvg: 74 },
    { topic: 'Analytical', yours: 92, groupAvg: 80 },
    { topic: 'Data Logic', yours: 75, groupAvg: 62 },
  ] as AnalysisTopicRow[],
  difficulty: [
    { level: 'Easy' as const, solved: 20, total: 20, barClass: 'bg-tertiary-fixed-dim' },
    { level: 'Medium' as const, solved: 17, total: 20, barClass: 'bg-secondary-container' },
    { level: 'Hard' as const, solved: 7, total: 10, barClass: 'bg-primary-container' },
  ],
};

export const leaderboard = {
  podium: [
    {
      rank: 2 as const,
      name: 'Sarah J.',
      points: 2840,
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYnsTJWS7T4xOn-qdS_Y6cGSxUdMw56ARzn-A6kbUwHz7MlILfVIdK4V799kwflyNcTNl9umWLKFBr2zcFlvO5gIBckITYLJV6ZBWvLqkNUcl1022VLAw4SiLarAGNnsM6ZPBULu2KNMisSAodENfBi2T1Nqwsx3DUwUYPwobJ9fsQjE60IsYJaaA3BikwYLyiBf1qpRi_Q0QtwXIx5BcJqVcN_Ig2RXRIshj9vZqwi40KP1aQ3xJnrShM7EyHd3nfdP8XMEkuDfG7',
      tone: 'silver' as const,
      delay: 0.5,
    },
    {
      rank: 1 as const,
      name: 'Alex Chen',
      points: 3120,
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBfqPwTjjhjY7v6kJ6Y4ttiqmsjwhQcki88B4BBV4LA-NMz4VqY3tMrdcZqTGJRMeNPqCnZsxPJZVZQo8ekgfHBI5RshOOuM6E0RAWSI4qDtqZ-DlJiZHqCoqYOQ6DOdFExEb8lVl_f4gFhUMgb3X2ulrEunhkJQJhHMuGcSmxpoyu27Bkpc0rEvs6Lsxb3yAwhshODq4TyUb6krU4vmItS12RRrP_4rvux1FSBpyHpVD3bTMX9PahBiYuycv2RpNuwIzh-ApbHnKJH',
      tone: 'gold' as const,
      delay: 0,
    },
    {
      rank: 3 as const,
      name: 'Marcus T.',
      points: 2610,
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcs6dUxbimQyVD5qwJ5MqklFV467NEwJmS7hqbmVB7sYU8lCSTARZCJmfNBe8B1mo8M1iHfK9HJ2tMjGgHsPtfufRrAVm_jAKaDkhwcJvsxR0XPQ1JvNS1-6LDYPA0YzSCCB0jQJ7Z76GV8sTFPaPDZjN_DEqtnPrqMTqcF4IejHPFEm6uFqVhaDMV8BId1-j5_Qlu-AWINaH2tjfbZGZyPAFZ-tV3GaBgYQ3mbN9O1KrGuZRjs5EWwz7ILTe7AkokmFOnyLgI0qAA',
      tone: 'bronze' as const,
      delay: 1.2,
    },
  ] as PodiumEntry[],
  batch: [
    {
      rank: 1,
      name: 'Alex Chen',
      points: 3120,
      deltaPct: 12,
      highlight: 'gold',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNhahTgbc8t0krvFsBqX9QjIjJ80YM2LSKkZK8G-T3bkUlqIRnHicm6Cel_VX75CioLjFPuEHKlB-vuzfLgyhV8CwVjuWtEL-QORxKFwp4Vafy4oviDsuqsdVg8JdrkcNEU3iPm1wjXQsgJZX_oSulhjHCLaBVKJPIJIIRXAZHa9EeCSWdmMgWQh7ebWye2Ez08JQUG0rlnTRpjVx8svdZ7NAHn3FvJqfEdhCfhXxjjNqWmxEPXndKiCCu4lbbNp_ctOPOmlpda3r2',
    },
    {
      rank: 2,
      name: 'Sarah J.',
      points: 2840,
      deltaPct: 5,
      highlight: 'silver',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDioJtQpHFtTnrwWeLwhkUXYRJiqY7NHC_hYiXjSWNJ9exKCe-rWZxFZ0r9KT3oPgfGN9rOckIFBmBjlI8PFUEnCKkQ4NvH2QZJT04XooJskruyCDQSJYpBwLN2_IMHtT-yRNNz1zkKfNWdqYfFcT4WUeaRWarhMJFKwschE6ddkCtkIzSe-BvrJO7UGhOgunEpNKMsyw_L7u1RM7z4PwPiCJhnK_ZnryUwqCju5h0AheoNUBcXgFbvntG9Y6Ah5C4_pPQkU3f__RtJ',
    },
    {
      rank: 42,
      name: 'You (David M.)',
      points: 2150,
      deltaPct: 18,
      isCurrentUser: true,
      highlight: 'none',
      badge: 'Top 5%',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBFbSKtnB7Y3s7ayR42_X7xDPYFiw_InPrrbJH1_gFgYleqIZZUqWkl1bKfEhKKd1h36AStDmhdMX5efIzyXCSADi6upw2PhOi6eDAvWxSo77gB3EgH-Edeo4f3OwNi-cJcaPnusu4rBDCoyMw18EAzJ5zrm2r2spBHLHNK8CS_6WClEaBpemrgz590vAmto6bCa3vHGpVYiIFenp8sujYl-4dnK-xDMAfjPS_4xWNU6u1ZbJSIb6-VejT59QUX8JiVvFOCHLRB9C7J',
    },
    {
      rank: 3,
      name: 'Marcus T.',
      points: 2610,
      deltaPct: -2,
      highlight: 'bronze',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPMCq_iWuTLQvLDxAss78xACDNk-cr5cymqlY2YTMQYAgFSm4uhT794oOCz6NXIgawMDklFz4DBeOPFlTUoRfCLrRq9INWH1B4MR-3UvkprzW8niYBIK1nhzc8m1DXiJ2JkQ5_kx5eGSJfD_z066Xuw_aUTX_20rpi9ocYDDwuxtLfbT002WLf18yfd_pJiwYC8St8m1n6D5R7YKNTHiNfe6jkyRFDR-2tr3QmPBjtnPGxtd_NuE-UHuFBG2xnE8SZ1GrTmWEqzETx',
    },
  ] as LeaderRow[],
  subject: [
    {
      rank: 1,
      name: 'Elena Rostova',
      accuracy: 99.2,
      timePerAvg: '12.4s',
      deltaPct: 0,
      highlight: 'gold',
    },
    {
      rank: 5,
      name: 'You',
      accuracy: 96.8,
      timePerAvg: '18.1s',
      deltaPct: 0,
      isCurrentUser: true,
      badge: 'New High!',
      highlight: 'none',
    },
    {
      rank: 2,
      name: 'Kevin Vance',
      accuracy: 98.5,
      timePerAvg: '15.2s',
      deltaPct: 0,
      highlight: 'silver',
    },
    {
      rank: 3,
      name: 'Sriya Malot',
      accuracy: 98.1,
      timePerAvg: '14.9s',
      deltaPct: 0,
      highlight: 'bronze',
    },
  ] as LeaderRow[],
  userPerformance: {
    rank: 42,
    outOf: 1240,
    masteryPct: 88,
    streakDays: 14,
    percentile: 'Top 5% in your batch',
  } as UserPerformance,
  motivation: {
    headline: "You're only 80 points away from Rank 35!",
    body:
      "Based on your recent trajectory in 'Advanced Calculus', an extra 15-minute practice session today could propel you into the next percentile tier.",
  },
};

export const insightsProfile: InsightsMetric[] = [
  {
    label: 'Learning Speed',
    percent: 82,
    tone: 'primary',
    caption: 'Top 12% in cohort',
  },
  {
    label: 'Consistency Score',
    percent: 68,
    tone: 'secondary',
    caption: 'Maintaining 4-day streak',
  },
  {
    label: 'Retention Score',
    percent: 91,
    tone: 'tertiary',
    caption: 'Spaced repetition optimal',
  },
];

export const revisionPriorities: RevisionItem[] = [
  {
    name: 'Multivariate Integration',
    status: 'AI Recommended',
    statusClass: 'bg-secondary-fixed text-on-secondary-fixed',
    icon: 'warning',
    iconBg: 'bg-error-container',
    iconColor: 'text-error',
    note: 'Last accessed: 14 days ago',
  },
  {
    name: 'Quantum Wave Functions',
    status: 'High Impact',
    statusClass: 'bg-primary-fixed text-on-primary-fixed',
    icon: 'update',
    iconBg: 'bg-tertiary-fixed-dim/20',
    iconColor: 'text-on-tertiary-fixed-variant',
    note: 'Knowledge decay detected',
  },
  {
    name: 'Discrete Fourier Transforms',
    status: 'Suggested',
    statusClass: 'bg-surface-container-highest text-on-surface-variant',
    icon: 'history_edu',
    iconBg: 'bg-surface-container',
    iconColor: 'text-outline',
    note: 'Prerequisite for Module 8',
  },
];

// Deterministic 72-cell knowledge-gap heatmap. The static mock uses random
// `document.write` at runtime; we use a seeded pseudo-random so layout is stable.
const INSIGHTS_INTENSITY_CLASS: Record<InsightsHeatmapCell['intensity'], string> = {
  10: 'bg-error/20',
  30: 'bg-primary-container/30',
  50: 'bg-primary-container/50',
  70: 'bg-primary-container/70',
  90: 'bg-primary-container/90',
  100: 'bg-primary-container',
};

function seededRand(seed: number) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

const INSIGHTS_INTENSITIES: InsightsHeatmapCell['intensity'][] = [10, 30, 50, 70, 90, 100];
const INSIGHTS_MODULES = ['Calculus', 'Linear Algebra', 'Probability', 'Logic', 'Mechanics', 'Thermodynamics'];

export function genInsightsHeatmap(count = 72): InsightsHeatmapCell[] {
  const rand = seededRand(42);
  const out: InsightsHeatmapCell[] = [];
  for (let i = 0; i < count; i++) {
    const intensity = INSIGHTS_INTENSITIES[Math.floor(rand() * INSIGHTS_INTENSITIES.length)];
    out.push({
      module: INSIGHTS_MODULES[Math.floor(i / 12) % INSIGHTS_MODULES.length],
      score: 60 + Math.floor(rand() * 40),
      trend: rand() > 0.4 ? 'up' : rand() > 0.5 ? 'flat' : 'down',
      intensity,
      cellClass: INSIGHTS_INTENSITY_CLASS[intensity],
    });
  }
  return out;
}
