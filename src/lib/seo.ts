/**
 * Per-route SEO metadata.
 *
 * The app is a client-side SPA: every route is served the same static
 * index.html, so without this every page would report the homepage's title,
 * description and — most damagingly — the homepage's canonical URL, telling
 * Google that every page is a duplicate of `/`. This module keeps the document
 * head in sync with the active route instead.
 */

export const SITE_URL = 'https://conceptcrack.com';
const SITE_NAME = 'Concept Crack';

/** Appended to page titles so every tab is branded, without repeating on the home page. */
const TITLE_SUFFIX = ` | ${SITE_NAME}`;

export interface PageSeo {
  title: string;
  description: string;
  /** Set for pages that should never appear in search results. */
  noindex?: boolean;
}

/**
 * Public, indexable pages. Titles are written to be distinct and
 * keyword-bearing — Google treats near-identical titles as duplicates.
 */
export const SEO_BY_PATH: Record<string, PageSeo> = {
  '/': {
    title: 'Concept Crack — AI-Powered JEE & NEET Exam Preparation',
    description:
      'AI-powered JEE and NEET preparation with adaptive practice, full-length mock tests, CBT exam simulation, deep analytics and an AI study Companion. Every lesson, mastered.',
  },
  '/about': {
    title: 'About Us — Built to Help Every Student Study With Clarity',
    description:
      'Learn how Concept Crack helps JEE and NEET aspirants study with clarity — our mission, our approach to adaptive AI learning, and the team building it.',
  },
  '/faq': {
    title: 'Frequently Asked Questions About JEE & NEET Prep',
    description:
      'How Concept Crack works, which exams it covers, how the AI adaptive engine analyses your answers, and how full-length mock tests are created.',
  },
  '/question-bank': {
    title: 'JEE & NEET Question Bank — Chapter & Topic-Wise Practice',
    description:
      'A structured question bank for serious practice, organised by subject, chapter and topic across Physics, Chemistry, Mathematics and Biology.',
  },
  '/mock-tests': {
    title: 'Full-Length JEE & NEET Mock Tests With CBT Simulation',
    description:
      'Full exam simulations with timed practice and detailed review. Build stamina, time management and confidence under realistic exam conditions.',
  },
  '/careers': {
    title: 'Careers — Help Build the Future of Exam Preparation',
    description:
      'Open roles at Concept Crack. Join us in building AI-powered learning tools for the next generation of JEE and NEET aspirants.',
  },
  '/contact': {
    title: 'Contact Us',
    description:
      'Get in touch with the Concept Crack team. We usually reply within one working day. Book a demo or request a custom quote for your institute.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description:
      'How Concept Crack collects, uses and protects student data — we only use data to power the learning experience.',
  },
  '/terms': {
    title: 'Terms of Service',
    description:
      'Simple rules for using Concept Crack responsibly, written to protect students, faculty and the product experience.',
  },
  '/refund': {
    title: 'Refund Policy',
    description:
      'Clear guidance if you need help with a Concept Crack purchase, including eligibility and how to request a refund.',
  },
  '/login': {
    title: 'Sign In',
    description: 'Sign in to your Concept Crack student, parent, faculty or admin account.',
  },
  // Kept out of the sitemap and out of search results — it has no lasting
  // content — but it still needs a real browser-tab title.
  '/coming-soon': {
    title: 'Coming Soon',
    description: 'Concept Crack subscription plans are launching soon.',
    noindex: true,
  },
};

/** Fallback for signed-in portals and anything unmapped — never indexed. */
const PRIVATE_SEO: PageSeo = {
  title: SITE_NAME,
  description: '',
  noindex: true,
};

export function seoForPath(pathname: string): PageSeo {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return SEO_BY_PATH[clean] ?? PRIVATE_SEO;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    if (!content) return;
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Writes title, description, canonical and the social tags for `pathname`.
 * Called on every route change.
 */
export function applySeo(pathname: string): void {
  const seo = seoForPath(pathname);
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const url = `${SITE_URL}${clean === '/' ? '/' : clean}`;

  // Home page title already carries the brand; others get the suffix.
  const fullTitle = clean === '/' || seo.title.includes(SITE_NAME)
    ? seo.title
    : `${seo.title}${TITLE_SUFFIX}`;

  document.title = fullTitle;

  setMeta('meta[name="description"]', 'name', 'description', seo.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
  setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', url);
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);

  // Canonical must point at THIS page, not the homepage.
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);

  // Portals carry no crawlable content; robots.txt already disallows them, and
  // this is a second signal for anything that slips through.
  setMeta('meta[name="robots"]', 'name', 'robots',
    seo.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
}
