
// Helper to normalize text
function normalize(text: string): string {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, ""); // Remove special chars
}

const KEYWORD_CONCEPTS: Record<string, string> = {
  // BELLEZA Y CUIDADO PERSONAL
  'crema facial': 'Belleza y Salud:Cuidado de la Piel (Skincare):Cremas',
  'shampoo': 'Belleza y Salud:Cuidado del Cabello:Shampoo',
  'perfume mujer': 'Belleza y Salud:Perfumes y Fragancias:Mujer',
  'pasta dientes': 'Belleza y Salud:Cuidado Personal e Higiene:Bucal',
  'vitaminas': 'Belleza y Salud:Salud y Bienestar:Vitaminas',
  
  // DEPORTES Y FITNESS
  'caminadora': 'Deportes y Aire Libre:Fitness y Musculación (Gym en Casa):Cardio',
  'pesas': 'Deportes y Aire Libre:Fitness y Musculación (Gym en Casa):Pesas',
  'bicicleta': 'Deportes y Aire Libre:Ciclismo:Bicicletas',
  'balon futbol': 'Deportes y Aire Libre:Deportes de Equipo:Futbol',
  'casa campaña': 'Deportes y Aire Libre:Camping, Caza y Pesca:Camping',
  'raqueta tenis': 'Deportes y Aire Libre:Deportes de Raqueta:Tenis',
  'goggles natacion': 'Deportes y Aire Libre:Deportes Acuáticos:Natacion',
  'patines': 'Deportes y Aire Libre:Patines, Skate y Scooters:Patines'
};

function detectCategory(title: string) {
  const normalizedTitle = normalize(title);
  
  let detectedConcept: string | null = null;
  let maxLen = 0;
  
  for (const [key, concept] of Object.entries(KEYWORD_CONCEPTS)) {
    if (normalizedTitle.includes(key)) {
      if (key.length > maxLen) {
        detectedConcept = concept;
        maxLen = key.length;
      }
    }
  }
  
  if (!detectedConcept) return null;

  if (detectedConcept.startsWith('Belleza y Salud:')) {
    const parts = detectedConcept.split(':');
    return {
      gender: 'Belleza y Salud',
      category: parts[1],
      subcategory: parts[2] || null,
      confidence: 0.95
    };
  }

  if (detectedConcept.startsWith('Deportes y Aire Libre:')) {
    const parts = detectedConcept.split(':');
    return {
      gender: 'Deportes y Aire Libre',
      category: parts[1],
      subcategory: parts[2] || null,
      confidence: 0.95
    };
  }
  
  return null;
}

const testCases = [
  'crema facial',
  'shampoo',
  'perfume mujer',
  'pasta dientes',
  'vitaminas',
  'caminadora',
  'pesas',
  'bicicleta',
  'balon futbol',
  'casa campaña',
  'raqueta tenis',
  'goggles natacion',
  'patines'
];

console.log('Verifying Category Detection Logic...');

testCases.forEach(input => {
  const result = detectCategory(input);
  console.log(`Input: "${input}"`);
  if (result) {
    console.log(`  Gender: ${result.gender}`);
    console.log(`  Category: ${result.category}`);
    console.log(`  Subcategory: ${result.subcategory}`);
  } else {
    console.log('  Result: NULL');
  }
  console.log('---');
});
