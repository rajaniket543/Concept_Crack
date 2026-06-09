export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  initials: string;
}

export const testimonials: Testimonial[] = [
  {
    name: 'Aarav Mehta',
    role: 'JEE Aspirant · Class 12',
    initials: 'AM',
    quote:
      'The adaptive practice engine pinpointed my weak topics in mechanics within a week. My mock scores jumped 18 percentile points.',
  },
  {
    name: 'Priya Sharma',
    role: 'NEET Aspirant · Class 11',
    initials: 'PS',
    quote:
      'AI Insights explained exactly why I was losing marks in organic chemistry. The retention tracking is genuinely useful.',
  },
  {
    name: 'Dr. R. Iyer',
    role: 'Faculty · Resonance Academy',
    initials: 'RI',
    quote:
      'The question bank workflow is the cleanest I have used. Adding a chapter of 50 MCQs takes me under an hour.',
  },
];

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export const features: Feature[] = [
  {
    icon: 'auto_awesome',
    title: 'Adaptive Learning',
    body: 'AI tunes the difficulty and topic mix in real time based on your performance and retention curve.',
  },
  {
    icon: 'insights',
    title: 'Deep Analytics',
    body: 'Heatmaps, topic mastery, and knowledge gap detection across every subject and chapter.',
  },
  {
    icon: 'quiz',
    title: 'Exam Simulator',
    body: 'Full-length mocks with the exact interface, palette, and timing pressure of the real exam.',
  },
  {
    icon: 'leaderboard',
    title: 'Smart Leaderboards',
    body: 'Rank by batch, institute, city, or nationally — with fair comparisons across attempts.',
  },
  {
    icon: 'family_restroom',
    title: 'Parent Portal',
    body: 'Weekly progress reports and attendance tracking delivered straight to the family.',
  },
  {
    icon: 'verified',
    title: 'Faculty Tools',
    body: 'Question bank management, intervention alerts for at-risk students, batch-level analytics.',
  },
];

export interface Stat {
  value: string;
  label: string;
}

export const stats: Stat[] = [
  { value: '1.2M+', label: 'Practice questions solved' },
  { value: '94%', label: 'Student accuracy improvement' },
  { value: '420+', label: 'Institutes onboarded' },
  { value: '4.8/5', label: 'Average student rating' },
];
