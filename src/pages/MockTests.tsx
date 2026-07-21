import PublicInfoPage from '../components/PublicInfoPage';

export default function MockTests() {
  return (
    <PublicInfoPage
      eyebrow="Mock Tests"
      title="Full exam simulations with timed practice and review"
      subtitle="Mock tests help students build stamina, time management and confidence under realistic exam conditions."
      highlight="Recommended: take one mock each week and review it the same day."
      sections={[
        {
          title: 'Why mock tests matter',
          body: 'A timed full-length paper gives students a real sense of pacing and helps identify whether the issue is concept knowledge, speed or exam pressure.',
          bullets: [
            'Realistic exam timing and section structure',
            'Post-test analytics for accuracy, speed and weak topics',
            'Works alongside the AI companion for deeper review',
          ],
        },
        {
          title: 'How we recommend using them',
          body: 'Take the mock without pausing, then spend your review time on wrong answers, skipped questions and chapters that keep appearing in your weak areas.',
          bullets: [
            'Do one full test in a quiet setting',
            'Review the paper within 24 hours',
            'Turn your mistakes into chapter-wise practice',
          ],
        },
      ]}
      recommended={[
        'Use the Start Mock Test flow after logging in.',
        'Revisit the same test analysis a few days later to see if your weak areas improved.',
        'Pair mock tests with chapter drills for the best retention.',
      ]}
    />
  );
}
