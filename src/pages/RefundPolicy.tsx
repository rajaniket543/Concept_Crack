import PublicInfoPage from '../components/PublicInfoPage';

export default function RefundPolicy() {
  return (
    <PublicInfoPage
      eyebrow="Refund Policy"
      title="Clear guidance if you need help with a purchase"
      subtitle="Refund handling can depend on the purchase type, plan and timing. This page outlines the recommended approach in a simple way."
      highlight="Recommended: contact support as soon as possible if you think something is incorrect."
      sections={[
        {
          title: 'When refunds are typically reviewed',
          body: 'We review refund requests on a case-by-case basis, especially if there is a duplicate charge, a billing mistake or a technical issue that prevented use.',
          bullets: [
            'Billing mistakes or duplicate charges',
            'Technical issues that blocked access',
            'Plan activation problems that need manual fixing',
          ],
        },
        {
          title: 'What to include in a request',
          body: 'A good request helps us resolve things faster. Share your account email, payment details, the issue you saw and any screenshots that help explain the problem.',
          bullets: [
            'Account email and transaction details',
            'Short description of what happened',
            'Any screenshot or receipt that helps us verify the issue',
          ],
        },
        {
          title: 'Best next step',
          body: 'If you are unsure whether your case qualifies, contact us first. We will review the situation and tell you the recommended path.',
          bullets: [
            'Reach out through Contact Us',
            'Do not file multiple duplicate requests',
            'Keep the relevant payment information handy',
          ],
        },
      ]}
      recommended={[
        'Contact support quickly so we can investigate the transaction.',
        'Keep your receipt or invoice until the issue is fully resolved.',
        'If you plan to upgrade later, check the current plan features first.',
      ]}
    />
  );
}
