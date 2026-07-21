import PublicInfoPage from '../components/PublicInfoPage';

export default function FAQ() {
  return (
    <PublicInfoPage
      eyebrow="Frequently Asked Questions"
      title="Answers to the questions students ask most"
      subtitle="Here’s a quick guide to how Concept Crack works, what it covers, and how the AI helps you improve faster."
      highlight="If you still need help, use Contact Us and we’ll respond directly."
      sections={[
        {
          title: 'What exams are supported?',
          body: 'Concept Crack is built for JEE (Main + Advanced) and NEET UG with exam-style practice, mock tests and analytics tailored to each stream.',
        },
        {
          title: 'How does the AI help?',
          body: 'The AI reviews your attempts, finds weak topics, recommends what to revise next and helps generate smarter practice sessions.',
        },
        {
          title: 'Can I use it on mobile?',
          body: 'Yes. The platform is designed for phones, tablets, laptops and desktop browsers, so you can study from anywhere.',
        },
        {
          title: 'How are mock tests created?',
          body: 'Mock tests are assembled from the question bank with exam-like structure, so students can practice under realistic timing and patterns.',
        },
      ]}
      recommended={[
        'Start with a mock test to see your baseline performance.',
        'Open the AI Insights page after each attempt to find the next topic to revise.',
        'Use the Contact page if you need help with login, billing or exam settings.',
      ]}
    />
  );
}
