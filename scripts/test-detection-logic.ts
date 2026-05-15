
import { detectCategory } from '../lib/category-detection/core';
import { KEYWORD_CONCEPTS } from '../lib/category-detection/config';
import { normalize } from '../lib/category-detection/utils';

// Mock console.log to keep output clean or just let it log
// console.log = () => {};

console.log('--- Testing Category Detection Logic ---');

const testCases = [
  'cerveza',
  'vendo cerveza',
  'celular',
  'iphone 13',
  'calzado',
  'tenis nike',
  'consola',
  'nintendo switch',
  'software',
  'vegano'
];

testCases.forEach(title => {
  console.log(`\nTesting: "${title}"`);
  const result = detectCategory(title);
  if (result) {
    console.log(`✅ Match: ${result.gender} > ${result.category} > ${result.subcategory || '(None)'}`);
  } else {
    console.log(`❌ No match found`);
  }
});

console.log('\n--- Checking specific mappings ---');
console.log(`'cerveza' maps to: ${KEYWORD_CONCEPTS['cerveza']}`);
console.log(`'calzado' maps to: ${KEYWORD_CONCEPTS['calzado']}`);

