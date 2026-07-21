import PublicInfoPage from '../components/PublicInfoPage';

export default function QuestionBank() {
  return (
    <PublicInfoPage
      eyebrow="Question Bank"
      title="A structured bank built for serious practice"
      subtitle="Our question bank is organized by subject, chapter, topic and difficulty so students and faculty can find the right practice at the right time."
      highlight="Recommended next step: use the bank alongside mock tests for the best improvement cycle."
      sections={[
        {
          title: 'What the question bank is designed for',
          body: 'It helps students practice chapter-wise, faculty build tests quickly and the AI engine identify where a student is consistently losing marks.',
          bullets: [
            'Chapter-wise and topic-wise filtering',
            'Difficulty-aware practice for easy revision or tougher challenge sets',
            'Reusable question sets for tests, practice and remediation',
          ],
        },
        {
          title: 'How to get the most out of it',
          body: 'Mix focused drills with mock tests so you can review errors, strengthen weak areas and track progress over time.',
          bullets: [
            'Start with your weakest chapter',
            'Review explanations before moving to the next set',
            'Convert repeated mistakes into a revision list',
          ],
        },
      ]}
      recommended={[
        'Open the Practice module after logging in to begin chapter-wise drills.',
        'Ask faculty to assign question sets if you are studying in a batch.',
        'Check your Test Analysis after every attempt to see which questions need revision.',
      ]}
    />
  );
}
