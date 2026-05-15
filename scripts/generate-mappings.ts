
import * as fs from 'fs';
import * as path from 'path';

// Simple normalize function
function normalize(str: string): string {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Read categories.ts
const categoriesPath = path.join(process.cwd(), 'lib', 'categories.ts');
const categoriesContent = fs.readFileSync(categoriesPath, 'utf-8');

// Regex to extract structure
// This is a heuristic parser. It assumes indentation and structure.
// We'll look for 'Key': [ ... { id: '...', label: '...', subcategories: [ ... ] } ]

const lines = categoriesContent.split('\n');
let currentGender: string | null = null;
let currentCategory: string | null = null;
let currentCategoryId: string | null = null;

const newMappings: string[] = [];
const seenKeywords = new Set<string>();

// Read existing config to avoid duplicates
const configPath = path.join(process.cwd(), 'lib', 'category-detection', 'config.ts');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Extract existing keywords from config
const existingKeywords = new Set<string>();
const configMatch = configContent.matchAll(/'([^']+)':/g);
for (const match of configMatch) {
  existingKeywords.add(match[1]);
}

// Helper to add mapping
function addMapping(label: string, path: string) {
  // Variations
  const keywords = [
    normalize(label),
    // specific plural handling if needed, but normalize handles most
  ];

  // Split label by ' y ' or ',' to get sub-keywords
  if (label.includes(' y ')) {
    keywords.push(...label.split(' y ').map(normalize));
  }
  if (label.includes(',')) {
    keywords.push(...label.split(',').map(normalize));
  }
  // Remove parenthesis content for cleaner keyword
  if (label.includes('(')) {
    keywords.push(normalize(label.replace(/\(.*?\)/g, '')));
  }

  keywords.forEach(k => {
    if (k.length < 3) return;
    if (existingKeywords.has(k)) return;
    if (seenKeywords.has(k)) return;
    
    seenKeywords.add(k);
    newMappings.push(`  '${k}': '${path}',`);
  });
}

// Parsing loop
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect Gender Key (e.g. 'Mujer': [)
  const genderMatch = line.match(/^  '([^']+)': \[/);
  if (genderMatch) {
    currentGender = genderMatch[1];
    continue;
  }

  // Detect Category (e.g. id: 'Calzado',)
  // We need to look for the object start {
  // and then the id and label fields inside
  
  // Simplified: Look for `id: '...',` and `label: '...',` at depth 6 spaces
  if (line.match(/^      id: '([^']+)',/)) {
    const idMatch = line.match(/^      id: '([^']+)',/);
    currentCategoryId = idMatch![1];
    
    // Look ahead for label
    const labelLine = lines[i+1];
    const labelMatch = labelLine.match(/^      label: '([^']+)',/);
    if (labelMatch) {
      currentCategory = labelMatch[1];
      // Add mapping for Category
      if (currentGender && currentCategoryId) {
        addMapping(currentCategory, `${currentGender}:${currentCategoryId}`);
      }
    }
  }

  // Detect Subcategory (e.g. id: 'Tenis',) at depth 8 spaces
  if (line.match(/^        { id: '([^']+)', label: '([^']+)',/)) {
     const match = line.match(/^        { id: '([^']+)', label: '([^']+)',/);
     if (match && currentGender && currentCategoryId) {
       const subId = match[1];
       const subLabel = match[2];
       addMapping(subLabel, `${currentGender}:${currentCategoryId}:${subId}`);
     }
  }
}

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'new_mappings.txt'), newMappings.join('\n'));
console.log('Mappings written to scripts/new_mappings.txt');
