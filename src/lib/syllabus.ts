// Canonical JEE (Physics/Chemistry/Mathematics) and NEET (Biology) syllabus
// topics, per the standard NCERT-aligned curriculum. Used to keep Practice
// mode honest — faculty/uploaders sometimes create chapter or question-bank
// entries that aren't real syllabus topics (mock-test section labels, stray
// imports, mislabelled subjects). Anything that doesn't match a real topic
// gets grouped separately instead of polluting the main topic list.

const PHYSICS_TOPICS = [
  'units and measurement', 'measurement', 'kinematics', 'motion in a straight line',
  'motion in a plane', 'laws of motion', 'work energy and power', 'work power energy',
  'system of particles', 'rotational motion', 'gravitation', 'mechanical properties of solids',
  'elasticity', 'mechanical properties of fluids', 'fluid mechanics', 'thermal properties of matter',
  'thermodynamics', 'kinetic theory', 'oscillations', 'simple harmonic motion', 'waves',
  'electric charges and fields', 'electrostatics', 'electrostatic potential', 'capacitance',
  'current electricity', 'moving charges and magnetism', 'magnetic effects of current',
  'magnetism and matter', 'electromagnetic induction', 'alternating current',
  'electromagnetic waves', 'ray optics', 'optical instruments', 'wave optics',
  'dual nature of radiation', 'dual nature of matter', 'photoelectric effect', 'atoms',
  'nuclei', 'nuclear physics', 'semiconductor', 'communication systems', 'circular motion',
  'centre of mass', 'collisions', 'friction', 'projectile motion', 'vectors',
];

const CHEMISTRY_TOPICS = [
  'basic concepts of chemistry', 'mole concept', 'structure of atom', 'atomic structure',
  'classification of elements', 'periodicity', 'periodic table', 'chemical bonding',
  'molecular structure', 'states of matter', 'gaseous state', 'thermodynamics', 'equilibrium',
  'ionic equilibrium', 'redox reactions', 'hydrogen', 's-block', 's block elements',
  'p-block', 'p block elements', 'organic chemistry', 'hydrocarbons', 'environmental chemistry',
  'solid state', 'solutions', 'electrochemistry', 'chemical kinetics', 'surface chemistry',
  'isolation of elements', 'metallurgy', 'd and f block', 'd-block', 'f-block',
  'coordination compounds', 'haloalkanes', 'haloarenes', 'alcohols', 'phenols', 'ethers',
  'aldehydes', 'ketones', 'carboxylic acids', 'amines', 'biomolecules', 'polymers',
  'chemistry in everyday life', 'nomenclature', 'chemical equilibrium',
];

const MATH_TOPICS = [
  'sets', 'relations and functions', 'complex numbers', 'quadratic equations', 'matrices',
  'determinants', 'permutations and combinations', 'binomial theorem', 'sequences and series',
  'limits', 'continuity and differentiability', 'differentiation', 'integral calculus',
  'integration', 'differential equations', 'coordinate geometry', 'straight lines', 'circles',
  'conic sections', 'parabola', 'ellipse', 'hyperbola', 'three dimensional geometry',
  'vector algebra', 'vectors', 'statistics', 'probability', 'trigonometry',
  'inverse trigonometric functions', 'mathematical reasoning', 'mathematical induction',
  'application of derivatives', 'application of integrals', 'linear programming', 'algebra',
];

const BIOLOGY_TOPICS = [
  'diversity in living world', 'living world', 'biological classification', 'plant kingdom',
  'animal kingdom', 'morphology of flowering plants', 'anatomy of flowering plants',
  'structural organisation in animals', 'cell structure', 'cell the unit of life',
  'biomolecules', 'cell cycle', 'cell division', 'transport in plants', 'mineral nutrition',
  'photosynthesis', 'respiration in plants', 'plant growth', 'digestion and absorption',
  'breathing and exchange of gases', 'body fluids and circulation', 'excretory products',
  'locomotion and movement', 'neural control', 'chemical coordination', 'reproduction',
  'sexual reproduction in flowering plants', 'human reproduction', 'reproductive health',
  'genetics', 'principles of inheritance', 'molecular basis of inheritance', 'evolution',
  'human health and disease', 'microbes in human welfare', 'biotechnology', 'ecology',
  'organisms and populations', 'ecosystem', 'biodiversity', 'environmental issues',
];

const TOPICS_BY_SUBJECT: Record<string, string[]> = {
  Physics: PHYSICS_TOPICS,
  Chemistry: CHEMISTRY_TOPICS,
  Mathematics: MATH_TOPICS,
  Biology: BIOLOGY_TOPICS,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Too generic on their own to count as a real topic match (would let almost
// anything through), even though they appear in real syllabus phrases.
const STOPWORDS = new Set(['and', 'the', 'of', 'in', 'for', 'to', 'a', 'an', 'basic', 'general', 'introduction']);

function significantWords(s: string): string[] {
  return s.split(' ').filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

/** The canonical syllabus topic (e.g. "centre of mass") that `chapterName`
 *  matches for `subject`, or null if it doesn't look like a real syllabus
 *  topic at all. Deliberately loose: a single shared significant word (e.g.
 *  "rotational" in both "Rotational Motion" and "Rotational Dynamics Part 2")
 *  is enough, since faculty phrase the same real topic in many different
 *  ways — but this still rejects names with no real overlap (e.g. "Cognitive
 *  Bias" shares no word with any physics topic). Real chapter-name spelling
 *  variants of the same real topic (e.g. "Center of mass" / "Centre of Mass")
 *  resolve to the same key here, which is what lets the UI merge them into
 *  one real topic entry instead of listing every spelling separately. */
export function canonicalTopicKey(subject: string, chapterName: string): string | null {
  const topics = TOPICS_BY_SUBJECT[subject];
  if (!topics) return null; // unknown subject — nothing to canonicalize against
  const name = normalize(chapterName);
  if (!name) return null;
  const exact = topics.find(topic => name.includes(topic) || topic.includes(name));
  if (exact) return exact;

  const nameWords = new Set(significantWords(name));
  if (nameWords.size === 0) return null;
  return topics.find(topic => significantWords(topic).some(w => nameWords.has(w))) ?? null;
}

/** True if `chapterName` looks like a real syllabus topic for `subject`. See
 *  `canonicalTopicKey` for the matching rules. Subjects with no known topic
 *  list (e.g. an unrecognised stream) are never filtered — we can't judge
 *  what we don't have a syllabus for. */
export function isCanonicalTopic(subject: string, chapterName: string): boolean {
  if (!TOPICS_BY_SUBJECT[subject]) return true;
  return canonicalTopicKey(subject, chapterName) !== null;
}
