import PublicInfoPage from '../components/PublicInfoPage';

export default function Careers() {
  return (
    <PublicInfoPage
      eyebrow="Careers"
      title="Help build the future of exam preparation"
      subtitle="We’re looking for people who care about learning, product quality and building tools that help students perform at their best."
      highlight="Recommended roles are listed below. If you don’t see your role, still reach out."
      sections={[
        {
          title: 'Open roles we recommend',
          body: 'Concept Crack is open to talented people who can move fast, think clearly and care about users.',
          bullets: [
            'Frontend Engineer - responsive UI, accessibility and polished product experiences',
            'Content & Curriculum Specialist - chapter mapping, exam patterns and question quality',
            'AI / Product Engineer - workflows, study recommendations and analytics',
          ],
        },
        {
          title: 'What we value',
          body: 'We care about ownership, clear communication and building practical features that make daily study easier for students and coaching teams.',
          bullets: [
            'You solve user problems, not just implementation tasks',
            'You like shipping, measuring and improving',
            'You are comfortable working across product, design and engineering',
          ],
        },
      ]}
      recommended={[
        'Send us your portfolio or resume through Contact Us.',
        'Mention any education, edtech or AI product experience.',
        'If you’re a student, intern or fresher, tell us what you want to build.',
      ]}
    />
  );
}
