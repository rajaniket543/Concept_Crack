// Important-formula bank for the pre-test Synopsis screen (Feature 1).
//
// The synopsis page shows the formulas most relevant to the test the student is
// about to attempt, auto-selected from the test's subject + chapters. We keep a
// curated static bank for common JEE/NEET chapters (instant, offline) and fall
// back to Gemini for chapters we don't cover yet (see generateFormulasAI).

import { askAI, hasAI } from './ai';

export interface Formula {
  name: string;
  expr: string;
  note?: string;
}

export interface FormulaGroup {
  subject: string;
  chapter: string;
  formulas: Formula[];
}

interface BankEntry {
  subject: string;
  /** Canonical chapter label shown to the student. */
  chapter: string;
  /** Keywords used to fuzzy-match a Firestore chapter name to this entry. */
  match: string[];
  formulas: Formula[];
}

// ── Curated bank ──────────────────────────────────────────────────────────────

const BANK: BankEntry[] = [
  // ── Physics ────────────────────────────────────────────────────────────────
  {
    subject: 'Physics',
    chapter: 'Kinematics',
    match: ['kinematic', 'motion in a straight', 'motion in a plane', 'rectilinear'],
    formulas: [
      { name: 'First equation of motion', expr: 'v = u + at' },
      { name: 'Second equation of motion', expr: 's = ut + ½at²' },
      { name: 'Third equation of motion', expr: 'v² = u² + 2as' },
      { name: 'Distance in nth second', expr: 'sₙ = u + ½a(2n − 1)' },
      { name: 'Projectile — time of flight', expr: 'T = 2u·sinθ / g' },
      { name: 'Projectile — max height', expr: 'H = u²sin²θ / 2g' },
      { name: 'Projectile — range', expr: 'R = u²sin2θ / g' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Laws of Motion',
    match: ['laws of motion', 'newton', 'friction', 'force'],
    formulas: [
      { name: "Newton's second law", expr: 'F = ma = dp/dt' },
      { name: 'Momentum', expr: 'p = mv' },
      { name: 'Impulse', expr: 'J = F·Δt = Δp' },
      { name: 'Friction force', expr: 'f = μN' },
      { name: 'Banking of roads', expr: 'tanθ = v² / rg' },
      { name: 'Centripetal force', expr: 'F = mv² / r = mω²r' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Work, Energy & Power',
    match: ['work', 'energy', 'power'],
    formulas: [
      { name: 'Work done', expr: 'W = F·d·cosθ' },
      { name: 'Kinetic energy', expr: 'KE = ½mv²' },
      { name: 'Potential energy', expr: 'PE = mgh' },
      { name: 'Work–energy theorem', expr: 'W_net = ΔKE' },
      { name: 'Power', expr: 'P = W/t = F·v' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Gravitation',
    match: ['gravitation', 'gravity'],
    formulas: [
      { name: 'Newton’s law of gravitation', expr: 'F = Gm₁m₂ / r²' },
      { name: 'Acceleration due to gravity', expr: 'g = GM / R²' },
      { name: 'Orbital velocity', expr: 'v₀ = √(GM / r)' },
      { name: 'Escape velocity', expr: 'vₑ = √(2GM / R)' },
      { name: 'Gravitational PE', expr: 'U = −Gm₁m₂ / r' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Electrostatics',
    match: ['electrostatic', 'electric charge', 'coulomb', 'electric field', 'capacitor', 'capacitance'],
    formulas: [
      { name: "Coulomb's law", expr: 'F = kq₁q₂ / r²,  k = 1/4πε₀' },
      { name: 'Electric field (point charge)', expr: 'E = kq / r²' },
      { name: 'Electric potential', expr: 'V = kq / r' },
      { name: 'Potential energy', expr: 'U = kq₁q₂ / r' },
      { name: 'Capacitance', expr: 'C = Q / V' },
      { name: 'Parallel-plate capacitor', expr: 'C = ε₀A / d' },
      { name: 'Energy stored', expr: 'U = ½CV² = Q²/2C' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Current Electricity',
    match: ['current electricity', 'current', 'ohm', 'circuit', 'resistance'],
    formulas: [
      { name: "Ohm's law", expr: 'V = IR' },
      { name: 'Power dissipated', expr: 'P = VI = I²R = V²/R' },
      { name: 'Resistivity', expr: 'R = ρL / A' },
      { name: 'Series resistance', expr: 'R = R₁ + R₂ + …' },
      { name: 'Parallel resistance', expr: '1/R = 1/R₁ + 1/R₂ + …' },
      { name: 'Drift velocity', expr: 'I = nAe·v_d' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Oscillations (SHM)',
    match: ['oscillation', 'shm', 'simple harmonic', 'pendulum', 'wave'],
    formulas: [
      { name: 'Displacement in SHM', expr: 'x = A·sin(ωt + φ)' },
      { name: 'Angular frequency', expr: 'ω = 2π/T = 2πf' },
      { name: 'Spring–mass period', expr: 'T = 2π√(m/k)' },
      { name: 'Simple pendulum', expr: 'T = 2π√(L/g)' },
      { name: 'Total energy', expr: 'E = ½mω²A²' },
    ],
  },
  {
    subject: 'Physics',
    chapter: 'Thermodynamics',
    match: ['thermodynamic', 'heat', 'kinetic theory', 'thermal'],
    formulas: [
      { name: 'Heat energy', expr: 'Q = mcΔT' },
      { name: 'First law', expr: 'ΔU = Q − W' },
      { name: 'Ideal gas equation', expr: 'PV = nRT' },
      { name: 'Work done by gas', expr: 'W = ∫P·dV' },
      { name: 'Efficiency of Carnot engine', expr: 'η = 1 − T_c/T_h' },
    ],
  },

  // ── Chemistry ────────────────────────────────────────────────────────────────
  {
    subject: 'Chemistry',
    chapter: 'Mole Concept & Solutions',
    match: ['mole', 'solution', 'concentration', 'molarity', 'stoichiometry', 'some basic concepts'],
    formulas: [
      { name: 'Molarity', expr: 'M = moles of solute / volume (L)' },
      { name: 'Molality', expr: 'm = moles of solute / mass of solvent (kg)' },
      { name: 'Mole fraction', expr: 'x_A = n_A / (n_A + n_B)' },
      { name: 'Dilution', expr: 'M₁V₁ = M₂V₂' },
      { name: 'Moles', expr: 'n = given mass / molar mass' },
      { name: 'ppm', expr: 'ppm = (mass of solute / mass of solution) × 10⁶' },
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Thermodynamics',
    match: ['thermodynamic', 'thermochemistry', 'enthalpy'],
    formulas: [
      { name: 'First law', expr: 'ΔU = q + w' },
      { name: 'Work (irreversible)', expr: 'w = −P_ext·ΔV' },
      { name: 'Enthalpy', expr: 'ΔH = ΔU + Δ(PV)' },
      { name: 'Gibbs free energy', expr: 'ΔG = ΔH − TΔS' },
      { name: 'Spontaneity', expr: 'ΔG = −RT·lnK' },
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Chemical Kinetics',
    match: ['kinetic', 'rate of reaction', 'reaction rate'],
    formulas: [
      { name: 'Rate law', expr: 'Rate = k[A]ˣ[B]ʸ' },
      { name: 'First-order rate constant', expr: 'k = (2.303/t)·log([A₀]/[A])' },
      { name: 'First-order half-life', expr: 't₁/₂ = 0.693 / k' },
      { name: 'Arrhenius equation', expr: 'k = A·e^(−Ea/RT)' },
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Equilibrium',
    match: ['equilibrium', 'ionic', 'acid', 'base', 'ph'],
    formulas: [
      { name: 'Equilibrium constant', expr: 'K_c = [products] / [reactants]' },
      { name: 'Kp–Kc relation', expr: 'K_p = K_c(RT)^Δn' },
      { name: 'pH', expr: 'pH = −log[H⁺]' },
      { name: 'Ionic product of water', expr: 'K_w = [H⁺][OH⁻] = 10⁻¹⁴' },
      { name: 'pH + pOH', expr: 'pH + pOH = 14' },
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Electrochemistry',
    match: ['electrochem', 'redox', 'cell', 'nernst'],
    formulas: [
      { name: 'Cell potential', expr: 'E°_cell = E°_cathode − E°_anode' },
      { name: 'Nernst equation', expr: 'E = E° − (0.059/n)·log Q' },
      { name: 'Gibbs energy', expr: 'ΔG = −nFE_cell' },
      { name: "Faraday's law", expr: 'm = (M·I·t) / (n·F)' },
    ],
  },
  {
    subject: 'Chemistry',
    chapter: 'Atomic Structure',
    match: ['atomic structure', 'atom', 'quantum', 'bohr'],
    formulas: [
      { name: 'Energy of nth orbit (H)', expr: 'Eₙ = −13.6/n² eV' },
      { name: 'de Broglie wavelength', expr: 'λ = h / mv' },
      { name: 'Rydberg equation', expr: '1/λ = R(1/n₁² − 1/n₂²)' },
      { name: 'Photon energy', expr: 'E = hν = hc/λ' },
    ],
  },

  // ── Mathematics ────────────────────────────────────────────────────────────────
  {
    subject: 'Mathematics',
    chapter: 'Trigonometry',
    match: ['trigonometr', 'trig'],
    formulas: [
      { name: 'Pythagorean identity', expr: 'sin²θ + cos²θ = 1' },
      { name: 'Secant identity', expr: '1 + tan²θ = sec²θ' },
      { name: 'Cosecant identity', expr: '1 + cot²θ = cosec²θ' },
      { name: 'Sum of angles', expr: 'sin(A ± B) = sinA·cosB ± cosA·sinB' },
      { name: 'Cosine of sum', expr: 'cos(A ± B) = cosA·cosB ∓ sinA·sinB' },
      { name: 'Double angle', expr: 'sin2θ = 2sinθcosθ,  cos2θ = 1 − 2sin²θ' },
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Differentiation',
    match: ['differ', 'derivative', 'continuity', 'calculus'],
    formulas: [
      { name: 'Power rule', expr: 'd/dx (xⁿ) = n·xⁿ⁻¹' },
      { name: 'Trig derivatives', expr: 'd/dx(sinx)=cosx,  d/dx(cosx)=−sinx' },
      { name: 'Exponential / log', expr: 'd/dx(eˣ)=eˣ,  d/dx(lnx)=1/x' },
      { name: 'Product rule', expr: '(uv)′ = u′v + uv′' },
      { name: 'Quotient rule', expr: '(u/v)′ = (u′v − uv′)/v²' },
      { name: 'Chain rule', expr: 'dy/dx = (dy/du)·(du/dx)' },
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Integration',
    match: ['integr', 'antiderivative'],
    formulas: [
      { name: 'Power rule', expr: '∫xⁿ dx = xⁿ⁺¹/(n+1) + C' },
      { name: 'Reciprocal', expr: '∫(1/x) dx = ln|x| + C' },
      { name: 'Exponential', expr: '∫eˣ dx = eˣ + C' },
      { name: 'Trigonometric', expr: '∫sinx dx = −cosx,  ∫cosx dx = sinx' },
      { name: 'By parts', expr: '∫u·v dx = u∫v − ∫(u′∫v) dx' },
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Quadratic Equations',
    match: ['quadratic', 'polynomial'],
    formulas: [
      { name: 'Roots', expr: 'x = (−b ± √(b² − 4ac)) / 2a' },
      { name: 'Sum of roots', expr: 'α + β = −b/a' },
      { name: 'Product of roots', expr: 'αβ = c/a' },
      { name: 'Discriminant', expr: 'D = b² − 4ac' },
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Straight Lines & Circles',
    match: ['coordinate', 'straight line', 'circle', 'conic'],
    formulas: [
      { name: 'Distance formula', expr: 'd = √((x₂−x₁)² + (y₂−y₁)²)' },
      { name: 'Slope', expr: 'm = (y₂−y₁)/(x₂−x₁)' },
      { name: 'Slope-intercept line', expr: 'y = mx + c' },
      { name: 'Circle (centre origin)', expr: 'x² + y² = r²' },
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Vectors & 3D',
    match: ['vector', 'three dimensional', '3d geometry'],
    formulas: [
      { name: 'Dot product', expr: 'a·b = |a||b|cosθ' },
      { name: 'Cross product', expr: '|a×b| = |a||b|sinθ' },
      { name: 'Magnitude', expr: '|a| = √(a₁² + a₂² + a₃²)' },
    ],
  },
  {
    subject: 'Mathematics',
    chapter: 'Probability',
    match: ['probability', 'statistics'],
    formulas: [
      { name: 'Basic probability', expr: 'P(A) = favourable / total' },
      { name: 'Addition rule', expr: 'P(A∪B) = P(A) + P(B) − P(A∩B)' },
      { name: 'Conditional probability', expr: 'P(A|B) = P(A∩B)/P(B)' },
      { name: "Bayes' theorem", expr: 'P(A|B) = P(B|A)·P(A) / P(B)' },
    ],
  },

  // ── Biology (NEET) ──────────────────────────────────────────────────────────
  {
    subject: 'Biology',
    chapter: 'Genetics & Evolution',
    match: ['genetic', 'evolution', 'inheritance', 'hardy'],
    formulas: [
      { name: 'Hardy–Weinberg', expr: 'p² + 2pq + q² = 1,  p + q = 1' },
      { name: 'Test cross ratio', expr: 'Monohybrid 3:1,  Dihybrid 9:3:3:1' },
    ],
  },
  {
    subject: 'Biology',
    chapter: 'Human Physiology',
    match: ['physiology', 'circulation', 'breathing', 'excretion', 'body fluid'],
    formulas: [
      { name: 'Cardiac output', expr: 'CO = Stroke Volume × Heart Rate' },
      { name: 'Pulmonary ventilation', expr: 'PV = Tidal Volume × Respiratory Rate' },
    ],
  },
];

// ── Matching ──────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function chapterMatches(chapter: string, entry: BankEntry): boolean {
  const c = norm(chapter);
  if (!c) return false;
  return entry.match.some(k => {
    const nk = norm(k);
    return c.includes(nk) || nk.includes(c);
  });
}

function findEntry(subject: string, chapter: string): BankEntry | null {
  const s = norm(subject);
  for (const entry of BANK) {
    if (s && norm(entry.subject) !== s) continue;
    if (chapterMatches(chapter, entry)) return entry;
  }
  return null;
}

/** Curated formulas for one specific subject+chapter, or null if not in the bank. */
export function getChapterFormulas(subject: string, chapter: string): FormulaGroup | null {
  const entry = findEntry(subject, chapter);
  return entry ? { subject: entry.subject, chapter: entry.chapter, formulas: entry.formulas } : null;
}

/**
 * A couple of foundational chapters for the given subject(s) — used so the
 * synopsis formula section is never empty even when no chapter matched.
 */
export function getSubjectHighlights(subjects: string[], max = 2): FormulaGroup[] {
  const subjectSet = new Set(subjects.map(norm));
  const out: FormulaGroup[] = [];
  const seen = new Set<string>();
  for (const entry of BANK) {
    if (subjectSet.size > 0 && !subjectSet.has(norm(entry.subject))) continue;
    const key = `${entry.subject}::${entry.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ subject: entry.subject, chapter: entry.chapter, formulas: entry.formulas });
    if (out.length >= max) break;
  }
  return out;
}

// ── Gemini fallback ───────────────────────────────────────────────────────────

/**
 * Ask Gemini for the key formulas of a specific subject+chapter when the static
 * bank has no entry. Returns [] on any failure so callers degrade gracefully.
 */
export async function generateFormulasAI(subject: string, chapter: string): Promise<Formula[]> {
  if (!hasAI()) return [];
  try {
    const prompt =
      `List the 5 to 7 most important exam formulas for the ${subject} chapter "${chapter}" ` +
      `(Indian JEE/NEET syllabus). Reply ONLY with a JSON array, no markdown, each item ` +
      `{"name": short label, "expr": the formula using plain unicode math symbols}. ` +
      `Keep expr short and single-line.`;
    const raw = await askAI(prompt, { maxTokens: 600, temperature: 0.2 });
    const jsonText = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = jsonText.indexOf('[');
    const end = jsonText.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    const parsed = JSON.parse(jsonText.slice(start, end + 1)) as Array<{ name?: string; expr?: string }>;
    return parsed
      .filter(f => f && typeof f.expr === 'string' && f.expr.trim())
      .map(f => ({ name: String(f.name ?? 'Formula').trim(), expr: String(f.expr).trim() }))
      .slice(0, 7);
  } catch {
    return [];
  }
}
