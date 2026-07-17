import PublicInfoPage from '../components/PublicInfoPage';

export default function About() {
  return (
    <PublicInfoPage
      eyebrow="About Concept Crack"
      title="Built to help every student study with clarity"
      subtitle="Concept Crack is an AI-powered preparation platform for JEE and NEET students, designed to turn practice, revision and testing into a guided daily system."
      highlight="Our goal is simple: make high-quality exam prep feel personal, measurable and consistent."
      sections={[
        {
          title: 'What we focus on',
          body: 'We combine adaptive practice, mock tests, performance analytics and a personal AI companion so students always know what to do next.',
          bullets: [
            'Adaptive practice that responds to weak concepts in real time',
            'Exam-style mock tests with clear review and analytics',
            'Student, parent, faculty and admin views built around the same learning data',
          ],
        },
        {
          title: 'Why students use us',
          body: 'Instead of guessing what to study, students get a practical path that surfaces gaps, repeats important concepts and keeps revision on track.',
          bullets: [
            'Clear next steps after every test',
            'Focused revision plans instead of random practice',
            'A study experience that works on mobile, tablet and desktop',
          ],
        },
      ]}
      recommended={[
        'Start with a free trial to explore the study flow end-to-end.',
        'Use the mock tests to get a real exam rhythm before the actual paper.',
        'Open AI Insights after each test to see your next best action.',
      ]}
    />
  );
}
