import PublicInfoPage from '../components/PublicInfoPage';

export default function TermsOfService() {
  return (
    <PublicInfoPage
      eyebrow="Terms of Service"
      title="Simple rules for using the platform responsibly"
      subtitle="These terms are meant to protect students, faculty and the product experience without burying you in legal noise."
      highlight="Recommended: keep your account secure and use the platform only for its intended educational purpose."
      sections={[
        {
          title: 'Acceptable use',
          body: 'Use the platform honestly and respectfully. Don’t try to break, scrape or misuse the system, and don’t share access in ways that create security risks.',
          bullets: [
            'Use your own account and credentials',
            'Do not attempt unauthorized access or tampering',
            'Respect question bank content and platform limitations',
          ],
        },
        {
          title: 'Subscriptions and content',
          body: 'Plans, access levels and content availability may change over time. Any premium features you see should be used according to the plan or institution setup you purchased.',
          bullets: [
            'Plan features are shown before purchase or activation',
            'Institution-level access may differ from personal plans',
            'Content and features may evolve as the product improves',
          ],
        },
        {
          title: 'Account responsibility',
          body: 'You are responsible for keeping your account details safe and for the activity that happens under your login unless you report a security issue to us quickly.',
          bullets: [
            'Keep passwords private',
            'Report suspicious activity early',
            'Update your account if your email or phone changes',
          ],
        },
      ]}
      recommended={[
        'Read the Refund Policy before purchasing or renewing a plan.',
        'Use Contact Us if you need clarification on plan access.',
        'Keep your login secure and don’t share credentials.',
      ]}
    />
  );
}
