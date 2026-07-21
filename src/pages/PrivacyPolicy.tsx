import PublicInfoPage from '../components/PublicInfoPage';

export default function PrivacyPolicy() {
  return (
    <PublicInfoPage
      eyebrow="Privacy Policy"
      title="We only use data to power the learning experience"
      subtitle="This page explains, in plain language, how we collect and use information to deliver the product, improve the experience and support users."
      highlight="Recommended: read the Contact and Terms pages alongside this policy."
      sections={[
        {
          title: 'What we collect',
          body: 'We may collect account details, study activity, test attempts, messages you send us and technical logs needed to keep the platform working.',
          bullets: [
            'Account and profile information',
            'Study history, test attempts and analytics',
            'Messages sent to support',
          ],
        },
        {
          title: 'How we use it',
          body: 'We use this information to personalize practice, generate reports, improve reliability and respond to support requests.',
          bullets: [
            'Provide student, parent, faculty and admin features',
            'Personalize recommendations and study plans',
            'Maintain security, debugging and product improvement',
          ],
        },
        {
          title: 'Your choices',
          body: 'You can update your account information, manage preferences and contact us if you want help understanding or correcting your data.',
          bullets: [
            'Request account support through Contact Us',
            'Change your password and profile information in Settings',
            'Ask us how your data is being used',
          ],
        },
      ]}
      recommended={[
        'Use a strong password and keep your account details current.',
        'Contact support if you want help with access or account changes.',
        'Review the Terms page to understand subscriptions and acceptable use.',
      ]}
    />
  );
}
