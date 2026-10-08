export type Subject = 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';
export interface GuestQuestion {
  id: string;
  subject: Subject;
  topic: string;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
}
// Public starter questions. No private question-bank or account access is needed.
export const guestQuestions: GuestQuestion[] = [
  { id: 'p1', subject: 'Physics', topic: 'Motion', text: 'A body starts from rest with constant acceleration 2 m/s². How far does it travel in 5 s?', options: ['10 m', '25 m', '50 m', '5 m'], correct: 1, explanation: 's = ut + ½at² = 0 + ½ × 2 × 25 = 25 m.' },
  { id: 'p2', subject: 'Physics', topic: 'Laws of motion', text: 'What net force accelerates a 3 kg mass at 4 m/s²?', options: ['7 N', '1.33 N', '12 N', '0.75 N'], correct: 2, explanation: 'Newton’s second law gives F = ma = 3 × 4 = 12 N.' },
  { id: 'p3', subject: 'Physics', topic: 'Electricity', text: 'A 6 Ω resistor is connected across 12 V. What current flows through it?', options: ['2 A', '72 A', '0.5 A', '6 A'], correct: 0, explanation: 'Ohm’s law gives I = V/R = 12/6 = 2 A.' },
  { id: 'p4', subject: 'Physics', topic: 'Work and energy', text: 'If the speed of a body doubles, its kinetic energy becomes:', options: ['Half', 'Twice', 'Unchanged', 'Four times'], correct: 3, explanation: 'Kinetic energy is ½mv², so doubling speed multiplies energy by 2² = 4.' },
  { id: 'p5', subject: 'Physics', topic: 'Waves', text: 'A wave has frequency 50 Hz and wavelength 4 m. Its speed is:', options: ['12.5 m/s', '200 m/s', '54 m/s', '100 m/s'], correct: 1, explanation: 'Wave speed v = fλ = 50 × 4 = 200 m/s.' },
  { id: 'c1', subject: 'Chemistry', topic: 'Mole concept', text: 'How many moles are present in 18 g of water? (Molar mass = 18 g/mol)', options: ['18 mol', '0.5 mol', '1 mol', '2 mol'], correct: 2, explanation: 'Number of moles = mass / molar mass = 18/18 = 1 mol.' },
  { id: 'c2', subject: 'Chemistry', topic: 'Atomic structure', text: 'The atomic number of an element equals the number of:', options: ['Neutrons', 'Protons', 'Nucleons', 'Electron shells'], correct: 1, explanation: 'Atomic number is defined as the number of protons in the nucleus.' },
  { id: 'c3', subject: 'Chemistry', topic: 'Chemical bonding', text: 'What is the molecular shape of methane (CH₄)?', options: ['Linear', 'Trigonal planar', 'Square planar', 'Tetrahedral'], correct: 3, explanation: 'Four bonding pairs around carbon with no lone pairs give a tetrahedral shape.' },
  { id: 'c4', subject: 'Chemistry', topic: 'Equilibrium', text: 'An aqueous solution has [H⁺] = 10⁻³ mol/L. Its pH is:', options: ['3', '11', '7', '−3'], correct: 0, explanation: 'pH = −log₁₀[H⁺] = −log₁₀(10⁻³) = 3.' },
  { id: 'c5', subject: 'Chemistry', topic: 'Redox', text: 'The oxidation number of sulfur in H₂SO₄ is:', options: ['+2', '+4', '+6', '−2'], correct: 2, explanation: 'For a neutral molecule, 2(+1) + x + 4(−2) = 0, so x = +6.' },
  { id: 'm1', subject: 'Mathematics', topic: 'Calculus', text: 'What is the derivative of x³ with respect to x?', options: ['x²', '3x²', '3x', 'x⁴/4'], correct: 1, explanation: 'The power rule gives d(xⁿ)/dx = nxⁿ⁻¹, hence 3x².' },
  { id: 'm2', subject: 'Mathematics', topic: 'Algebra', text: 'The roots of x² − 5x + 6 = 0 are:', options: ['1 and 6', '−2 and −3', '2 and 3', '−1 and −6'], correct: 2, explanation: 'Factorisation gives (x − 2)(x − 3) = 0, so x = 2 or 3.' },
  { id: 'm3', subject: 'Mathematics', topic: 'Trigonometry', text: 'What is sin²θ + cos²θ for any real angle θ?', options: ['1', '0', '2', 'sin 2θ'], correct: 0, explanation: 'The fundamental Pythagorean identity is sin²θ + cos²θ = 1.' },
  { id: 'm4', subject: 'Mathematics', topic: 'Probability', text: 'A fair six-sided die is rolled once. What is the probability of a prime number?', options: ['1/6', '1/3', '2/3', '1/2'], correct: 3, explanation: 'The prime outcomes are 2, 3 and 5: three out of six equally likely outcomes, so 3/6 = 1/2.' },
  { id: 'm5', subject: 'Mathematics', topic: 'Calculus', text: 'What is the definite integral of 2x from 0 to 2?', options: ['2', '4', '8', '0'], correct: 1, explanation: 'An antiderivative is x². Evaluating at the bounds gives 2² − 0² = 4.' },
  { id: 'b1', subject: 'Biology', topic: 'Cell biology', text: 'Which organelle is the main site of aerobic ATP production in eukaryotic cells?', options: ['Ribosome', 'Golgi apparatus', 'Mitochondrion', 'Lysosome'], correct: 2, explanation: 'Mitochondria contain the machinery for the citric acid cycle and oxidative phosphorylation.' },
  { id: 'b2', subject: 'Biology', topic: 'Genetics', text: 'In DNA, adenine pairs with:', options: ['Thymine', 'Uracil', 'Guanine', 'Cytosine'], correct: 0, explanation: 'DNA complementary base pairing is A–T and G–C. Uracil replaces thymine in RNA.' },
  { id: 'b3', subject: 'Biology', topic: 'Human physiology', text: 'The functional unit of the human kidney is the:', options: ['Neuron', 'Alveolus', 'Villus', 'Nephron'], correct: 3, explanation: 'Nephrons filter blood and modify the filtrate through reabsorption and secretion to form urine.' },
  { id: 'b4', subject: 'Biology', topic: 'Plant physiology', text: 'The oxygen released during photosynthesis comes from:', options: ['Carbon dioxide', 'Water', 'Glucose', 'Chlorophyll'], correct: 1, explanation: 'Photolysis of water in the light reactions releases oxygen, protons and electrons.' },
  { id: 'b5', subject: 'Biology', topic: 'Cell division', text: 'Meiosis normally produces daughter cells with:', options: ['Twice the parental chromosome number', 'The same chromosome number', 'Half the parental chromosome number', 'No chromosomes'], correct: 2, explanation: 'Meiosis is a reduction division: a diploid cell produces haploid cells.' },
];
