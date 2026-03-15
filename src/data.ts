import { Outcome, Concept, PedagogyPlan, StorySkeleton, DigitCharacter, Artifact } from './types';

export const ALBERTA_GRADE_4_OUTCOMES: Outcome[] = [
  {
    code: '4N1',
    strand: 'Number',
    description: 'Students apply place value to decimal numbers.',
    keywords: ['decimal', 'place value', 'tenths', 'hundredths'],
    grade: 4
  },
  {
    code: '4N2',
    strand: 'Number',
    description: 'Students add and subtract within 10 000, including decimal numbers to hundredths.',
    keywords: ['addition', 'subtraction', 'standard algorithms', 'estimation'],
    grade: 4
  },
  {
    code: '4N3',
    strand: 'Number',
    description: 'Students explain properties of prime and composite numbers, using multiplication and division.',
    keywords: ['prime', 'composite', 'factors', 'multiples'],
    grade: 4
  },
  {
    code: '4N4',
    strand: 'Number',
    description: 'Students multiply and divide natural numbers within 10 000.',
    keywords: ['multiplication', 'division', 'standard algorithms', 'remainders'],
    grade: 4
  },
  {
    code: '4N5',
    strand: 'Number',
    description: 'Students apply equivalence to the interpretation of fractions.',
    keywords: ['equivalent fractions', 'simplifying', 'number line'],
    grade: 4
  },
  {
    code: '4N6',
    strand: 'Number',
    description: 'Students interpret percentages.',
    keywords: ['percentage', 'fractions', 'decimals', 'part-whole'],
    grade: 4
  },
  {
    code: '4A1',
    strand: 'Algebra',
    description: 'Students represent and apply equality in multiple ways.',
    keywords: ['equality', 'equations', 'order of operations', 'unknown value'],
    grade: 4
  },
  {
    code: '4G1',
    strand: 'Geometry',
    description: 'Students analyze and explain geometric properties.',
    keywords: ['angles', 'quadrilaterals', 'triangles', 'polygons', 'transformations'],
    grade: 4
  },
  {
    code: '4M1',
    strand: 'Measurement',
    description: 'Students interpret and express area.',
    keywords: ['area', 'tiling', 'rectangles', 'square centimetres'],
    grade: 4
  },
  {
    code: '4M2',
    strand: 'Measurement',
    description: 'Students determine and express angles, using standard units.',
    keywords: ['angles', 'degrees', 'protractor', 'acute', 'obtuse', 'right'],
    grade: 4
  },
  {
    code: '4P1',
    strand: 'Patterns',
    description: 'Students interpret and explain arithmetic and geometric sequences.',
    keywords: ['sequences', 'arithmetic', 'geometric', 'Fibonacci'],
    grade: 4
  },
  {
    code: '4T1',
    strand: 'Time',
    description: 'Students communicate duration with standard units of time.',
    keywords: ['time', 'duration', 'minutes', 'hours', 'seconds'],
    grade: 4
  },
  {
    code: '4S1',
    strand: 'Statistics',
    description: 'Students evaluate the use of scale in graphical representations of data.',
    keywords: ['statistics', 'graphs', 'scale', 'pictographs', 'bar graphs'],
    grade: 4
  }
];

export const CONCEPTS: Concept[] = [
  {
    id: 'decimal-place-value',
    outcomeCode: '4N1',
    models: ['placeValueChart', 'numberLine', 'baseTenBlocks'],
    strategies: ['shiftingPlaceValue', 'composingDecomposing'],
    explanation: 'Each place in base-10 has one-tenth the value of the place to its left. Multiplying or dividing by 10 shifts the decimal point.'
  },
  {
    id: 'prime-composite',
    outcomeCode: '4N3',
    models: ['arrays', 'factorTrees'],
    strategies: ['findingFactors', 'divisibilityRules'],
    explanation: 'Prime numbers have only two factors: 1 and themselves. Composite numbers have more than two factors.'
  },
  {
    id: 'mult-divide-10000',
    outcomeCode: '4N4',
    models: ['areaModel', 'equalGroups', 'arrays'],
    strategies: ['standardAlgorithm', 'personalStrategies', 'estimation'],
    explanation: 'Multiplication and division can be solved using standard algorithms or personal strategies like partial products.'
  },
  {
    id: 'area-rectangles',
    outcomeCode: '4M1',
    models: ['tiling', 'gridPaper'],
    strategies: ['multiplyingSideLengths', 'estimationWithReferents'],
    explanation: 'Area is the amount of space inside a 2D shape. For a rectangle, it is the product of its length and width.'
  }
];

export const PEDAGOGY_PLANS: PedagogyPlan[] = [
  {
    conceptId: 'mult-equal-groups',
    stages: {
      concrete: 'Using physical counters to make 4 groups of 6.',
      pictorial: 'Drawing an array of 4 rows and 6 columns.',
      symbolic: 'Writing the equation 4 x 6 = 24.'
    },
    differentiation: {
      struggling: 'Focus on smaller numbers and physical models.',
      onLevel: 'Use arrays and decomposition strategies.',
      advanced: 'Apply to multi-digit multiplication using area models.'
    },
    checksForUnderstanding: [
      {
        task: 'Draw an array for 3 x 7 and explain why it shows multiplication.',
        explanationRequired: true
      }
    ]
  }
];

export const ARTIFACTS: Artifact[] = [
  {
    id: 'array-animation',
    type: 'animationTemplate',
    description: 'A grid of items slowly forming row by row to show multiplication.'
  },
  {
    id: 'digit-character-2',
    type: 'character',
    description: 'The Twin (2) character doing a rhythmic dance to represent doubling.'
  },
  {
    id: 'visual-cue-groups',
    type: 'visualPromptCue',
    description: 'Pulsing circles around groups of items to highlight equal grouping.'
  }
];

export const STORY_SKELETONS: StorySkeleton[] = [
  {
    conceptId: 'mult-equal-groups',
    beats: [
      { type: 'setup', description: 'The hero arrives at the [place] and meets [sidekick].' },
      { type: 'groupsIntro', description: 'They find [number] groups of [number] [noun].' },
      { type: 'representation', description: 'They arrange the [noun] into an array to count them faster.' },
      { type: 'reasoning', description: 'They realize that [number] rows of [number] is the same as [number] x [number].' },
      { type: 'generalize', description: 'They use this trick to solve a bigger problem.' },
      { type: 'reflection', description: 'The hero explains how the array helped them see the math.' }
    ],
    requiredModels: ['equalGroups', 'array'],
    forbiddenPatterns: ['pure mnemonic with no model or reasoning']
  }
];

export const DIGIT_CHARACTERS: DigitCharacter[] = [
  { 
    digit: 0, 
    name: "Zeno",
    trait: "The silent observer — always watching, never changing the total", 
    mathRule: "Multiplicative annihilator: any number times zero equals zero", 
    voiceStyle: "Whisper-like, mysterious, and thoughtful",
    personality: "Quiet and philosophical. Zeno believes in the power of the void. He is the ultimate equalizer because he can turn any number into himself with just a touch.",
    visualDescription: "A floating, translucent sphere that seems to absorb light. He wears a dark cloak that swirls like a galaxy.",
    numericProperties: { isEven: true, isPrime: false, factors: [] }
  },
  { 
    digit: 1, 
    name: "Ida",
    trait: "The loyal echo — reflects back exactly what you give", 
    mathRule: "Multiplicative identity: any number times one stays the same", 
    voiceStyle: "Calm, steady, and reassuring",
    personality: "Honest and steadfast. Ida doesn't change anyone; she reflects them exactly as they are. She is the foundation of all other numbers.",
    visualDescription: "A tall, slender figure made of polished silver. She carries a hand mirror that shows numbers their true selves.",
    numericProperties: { isEven: false, isPrime: false, factors: [1] }
  },
  { 
    digit: 2, 
    name: "Duo",
    trait: "The energetic twin-maker — loves to create doubles", 
    mathRule: "Doubling: multiplying by two doubles the value", 
    voiceStyle: "Bouncy, excited, and enthusiastic",
    personality: "Always in motion. Duo loves symmetry and pairs. He is the first prime number and the only even prime, making him quite unique.",
    visualDescription: "Two identical twins joined at the hip, wearing bright yellow tracksuits. They move in perfect sync.",
    numericProperties: { isEven: true, isPrime: true, factors: [1, 2] }
  },
  { 
    digit: 3, 
    name: "Tri",
    trait: "The triangle builder — finds groups of three everywhere", 
    mathRule: "Triangular and prime: the first odd prime number", 
    voiceStyle: "Quirky, playful, with a love of threes",
    personality: "A builder and a dreamer. Tri sees triangles everywhere. He is obsessed with stability and the number three.",
    visualDescription: "A character with a triangular hat and a cape made of three distinct layers. He carries a drafting compass.",
    numericProperties: { isEven: false, isPrime: true, factors: [1, 3] }
  },
  { 
    digit: 4, 
    name: "Quad",
    trait: "The steady square — grounded and balanced in all directions", 
    mathRule: "Square number: 4 = 2 × 2, the smallest composite square", 
    voiceStyle: "Solid, dependable, and organized",
    personality: "Reliable and solid. Quad loves right angles and four-sided shapes. He feels very 'complete' because he is a perfect square.",
    visualDescription: "A blocky, robot-like character with four arms and four legs. He looks like a walking cube.",
    numericProperties: { isEven: true, isPrime: false, factors: [1, 2, 4], isSquare: true }
  },
  { 
    digit: 5, 
    name: "Finn",
    trait: "The halfway hero — always finding the middle ground", 
    mathRule: "Half of ten: the anchor for skip counting and mental math", 
    voiceStyle: "Friendly, balanced, and easygoing",
    personality: "The social butterfly of the number world. Everyone loves Finn because he's easy to count by. He always ends a party with a 0 or a 5.",
    visualDescription: "A character with a giant hand for a head, always ready for a high-five. He wears a colorful vest with five pockets.",
    numericProperties: { isEven: false, isPrime: true, factors: [1, 5] }
  },
  { 
    digit: 6, 
    name: "Hex",
    trait: "The team player — loves combining smaller groups", 
    mathRule: "Product of 2 and 3: a composite number bridging even and odd", 
    voiceStyle: "Cooperative, warm, and encouraging",
    personality: "A perfectionist who loves harmony. Hex is the first 'perfect' number, meaning he is literally the sum of his parts.",
    visualDescription: "A character with a hexagonal body that glows with a soft, balanced light. He moves with grace.",
    numericProperties: { isEven: true, isPrime: false, factors: [1, 2, 3, 6], isPerfect: true }
  },
  { 
    digit: 7, 
    name: "Septimus",
    trait: "The lone adventurer — marches to its own beat", 
    mathRule: "Prime: cannot be divided evenly by any number except 1 and itself", 
    voiceStyle: "Bold, independent, and slightly mysterious",
    personality: "A bit of a loner but very lucky. Septimus doesn't follow the usual patterns of 2s, 5s, or 10s. He is a 'pure' prime.",
    visualDescription: "A wizard-like figure with a staff topped with a seven-pointed star. He wears a robe with seven different colors.",
    numericProperties: { isEven: false, isPrime: true, factors: [1, 7] }
  },
  { 
    digit: 8, 
    name: "Octo",
    trait: "The power doubler — doubles the doubles", 
    mathRule: "Cube of 2: 8 = 2 × 2 × 2, three layers of doubling", 
    voiceStyle: "Confident, strong, and rhythmic",
    personality: "Strong and complex. Octo is a cube, giving him a lot of depth. If you turn him on his side, he looks like infinity.",
    visualDescription: "An octopus-like character with eight mechanical legs. He wears a helmet shaped like a cube.",
    numericProperties: { isEven: true, isPrime: false, factors: [1, 2, 4, 8] }
  },
  { 
    digit: 9, 
    name: "Nona",
    trait: "The almost-ten — always just one step away from the big round number", 
    mathRule: "Square of 3 and complement of 10: 9 = 3 × 3, and 9 + 1 = 10", 
    voiceStyle: "Wise, reflective, and a little dramatic",
    personality: "The elder of the single digits. Nona is wise and powerful, being a square of the intellectual Tri. She is almost at the next level (10).",
    visualDescription: "A character with a flowing gown that has nine distinct patterns. She carries a staff with nine bells.",
    numericProperties: { isEven: false, isPrime: false, factors: [1, 3, 9], isSquare: true }
  }
];
