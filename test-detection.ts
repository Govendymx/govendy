
import { detectCategory, CategoryMatch } from './lib/category-detection';

// Simple test suite
const testCases = [
  // User Specific Requests
  'celulares',
  'carcasa de celular',
  'consola',
  'cerveza',
  'calzado',
  
  // Complex / Multi-word
  'Vestido de noche rojo',
  'iPhone 13 Pro',
  'Caja de Carton 30x30x30',
  
  // Gender checks
  'Tenis mujer',
  'Tenis hombre',
  'Perfume hombre',
  'Perfume mujer',
  
  // Specific Categories
  'Croquetas perro', // Mascotas
  'Taladro inalambrico', // Herramientas
  'Sillon reclinable', // Hogar
  'Lipstick rojo', // Belleza
  'Balon futbol', // Deportes
  'Software antivirus', // Software
  'Libro Harry Potter', // Entretenimiento
  'Bateria auto', // Automotriz
  'Refresco coca cola', // Alimentos
  'Tubo acero industrial' // Industrias
];

console.log('Running Category Detection Tests...\n');

testCases.forEach(test => {
  const result = detectCategory(test);
  console.log(`Input: "${test}"`);
  if (result) {
    console.log(`Match: ${result.category} > ${result.subcategory} > ${result.subSubcategory || 'N/A'}`);
    console.log(`Gender: ${result.gender}, Confidence: ${result.confidence.toFixed(2)}`);
  } else {
    console.log('No match found.');
  }
  console.log('---');
});

// Performance Benchmark
console.log('\nRunning Performance Benchmark (1000 iterations)...');
const start = Date.now();
// Use a mix of cached and uncached queries if possible, but for benchmark we use same query 
// to see cache speed, or different to see lookup speed.
// Let's test "Worst Case" (new query every time) vs "Best Case" (cached)
// But to test O(1) map, we care about lookup speed.

// 1. Cold Cache / Lookup Speed (by using random suffixes)
let lookupTime = 0;
for (let i = 0; i < 1000; i++) {
  const t0 = performance.now();
  detectCategory('Vestido de fiesta ' + i); // Unique strings to bypass cache? 
  // Wait, my cache key is the full string.
  // But my logic normalizes and looks up substrings.
  // 'Vestido de fiesta 1' -> 'vestido de fiesta' match.
  const t1 = performance.now();
  lookupTime += (t1 - t0);
}
console.log(`1000 Unique lookups: ${lookupTime.toFixed(2)}ms`);

// 2. Cached Speed
const tStartCache = performance.now();
for (let i = 0; i < 1000; i++) {
  detectCategory('Vestido de fiesta');
}
const tEndCache = performance.now();
console.log(`1000 Cached lookups: ${(tEndCache - tStartCache).toFixed(2)}ms`);
