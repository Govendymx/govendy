import { CategoryMatch, CategoryConcept } from './types';
import { KEYWORD_CONCEPTS, GENDER_KEYWORDS } from './config';
import { normalize } from './utils';

// --- Configuration & Cache ---

// Cache for detection results to avoid re-processing identical inputs
// Limit size to avoid memory leaks
const RESULT_CACHE = new Map<string, CategoryMatch>();
const MAX_CACHE_SIZE = 500;

// O(1) Lookup Map for Concepts
// We pre-normalize keys from config to ensure fast matching
const CONCEPT_MAP = new Map<string, string>();
let isMapInitialized = false;

function initializeConceptMap() {
  if (isMapInitialized) return;

  console.log('[AutoDetect] Initializing Concept Map with ' + Object.keys(KEYWORD_CONCEPTS).length + ' entries.');

  Object.entries(KEYWORD_CONCEPTS).forEach(([key, value]) => {
    // Keys in config should already be normalized, but we ensure it here
    CONCEPT_MAP.set(normalize(key), value);
  });

  isMapInitialized = true;
}

// --- Helper Functions ---

/**
 * Detects gender context from the input title
 */
function detectGender(normalizedTitle: string): string | null {
  const words = normalizedTitle.split(/\s+/);

  // Check exact words first (high priority)
  for (const word of words) {
    if (GENDER_KEYWORDS[word]) {
      return GENDER_KEYWORDS[word];
    }
  }

  return null;
}

/**
 * Finds the best matching concept in the title.
 * Prioritizes longest matching keyword (e.g. "vestido de noche" > "vestido").
 */
function findBestConcept(normalizedTitle: string): CategoryConcept | null {
  initializeConceptMap();

  const words = normalizedTitle.split(/\s+/);
  let bestConcept: CategoryConcept | null = null;

  // Sliding window approach to find multi-word matches
  // Max phrase length to check (e.g., 4 words)
  const MAX_PHRASE_LENGTH = 4;

  for (let i = 0; i < words.length; i++) {
    for (let len = MAX_PHRASE_LENGTH; len >= 1; len--) {
      if (i + len > words.length) continue;

      const phrase = words.slice(i, i + len).join(' ');

      if (CONCEPT_MAP.has(phrase)) {
        const conceptValue = CONCEPT_MAP.get(phrase)!;

        // Calculate a score based on length and position
        // Longer matches are better. Earlier matches are slightly better.
        const lengthScore = len * 10;
        const positionScore = (1 - (i / words.length)) * 2; // 0 to 2 bonus
        const score = lengthScore + positionScore;

        // If this match is better than previous best, keep it
        if (!bestConcept || score > bestConcept.score) {
          bestConcept = {
            concept: conceptValue,
            score: score,
            keyword: phrase
          };
        }
        break;
      }
    }
  }

  return bestConcept;
}

/**
 * Parses the colon-separated concept string into category parts.
 * Handles gender overrides if the category is gender-dependent.
 */
function resolveCategoryPath(
  conceptPath: string,
  detectedGender: string | null
): { root: string; category: string; subcategory: string | null } {

  const parts = conceptPath.split(':');
  let root = parts[0] || '';
  let category = parts[1] || '';
  let subcategory = parts[2] || null;

  // GENDER OVERRIDE LOGIC:
  // If we detected an explicit gender (Hombre/Mujer/Niños) in the title,
  // we check if the concept is a fashion concept (where root is usually Mujer or Hombre).
  // This allows "Zapatos Hombre" to map to "Hombre:Zapatos" even if the keyword "Zapatos" maps to "Mujer:Zapatos".

  const FASHION_ROOTS = ['Mujer', 'Hombre', 'Niños, Niñas y Bebés'];

  if (detectedGender && FASHION_ROOTS.includes(detectedGender)) {
    // If the current root is a fashion root, override it with the detected one
    if (FASHION_ROOTS.includes(root)) {
      root = detectedGender;
    }
  }

  return { root, category, subcategory };
}

// --- Main Detection Function ---

export function detectCategory(title: string): CategoryMatch | null {
  if (!title || !title.trim()) return null;

  // 1. Check Cache
  const cacheKey = title.trim();
  if (RESULT_CACHE.has(cacheKey)) {
    console.log('[AutoDetect] Cache hit for:', cacheKey);
    return RESULT_CACHE.get(cacheKey)!;
  }

  // 2. Normalize
  const normalizedTitle = normalize(title);
  console.log('[AutoDetect] Normalized:', normalizedTitle);

  // 3. Detect Gender
  const detectedGender = detectGender(normalizedTitle);
  if (detectedGender) console.log('[AutoDetect] Gender detected:', detectedGender);

  // 4. Find Best Concept
  const match = findBestConcept(normalizedTitle);

  if (!match) {
    console.log('[AutoDetect] No concept match found.');
    return null;
  }

  console.log('[AutoDetect] Concept matched:', match.concept, 'via keyword:', match.keyword);

  // 5. Resolve Path
  const { root, category, subcategory } = resolveCategoryPath(match.concept, detectedGender);

  // 6. Construct Result
  const confidence = 0.95;

  const result: CategoryMatch = {
    gender: root, // Root Category (e.g. "Electrónica y Tecnología" or "Mujer")
    category: category, // SubCategory Group (e.g. "Celulares y Telefonía")
    subcategory: subcategory, // SubCategory Item (e.g. "Smartphones")
    subSubcategory: null,
    confidence
  };

  // 7. Update Cache
  if (RESULT_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = RESULT_CACHE.keys().next().value;
    if (firstKey) RESULT_CACHE.delete(firstKey);
  }
  RESULT_CACHE.set(cacheKey, result);

  console.log('[AutoDetect] Result constructed:', result);
  return result;
}
