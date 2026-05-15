
import * as fs from 'fs';
import * as path from 'path';

const mappingsPath = path.join(process.cwd(), 'scripts', 'new_mappings.txt');
const configPath = path.join(process.cwd(), 'lib', 'category-detection', 'config.ts');

const mappings = fs.readFileSync(mappingsPath, 'utf-8');
let config = fs.readFileSync(configPath, 'utf-8');

// Find the last occurrence of '};'
const lastBraceIndex = config.lastIndexOf('};');

if (lastBraceIndex !== -1) {
  const newConfig = config.slice(0, lastBraceIndex) + 
    '\n  // --- AUTO-GENERATED MAPPINGS FROM CATEGORY STRUCTURE ---\n' +
    mappings + 
    '\n' + 
    config.slice(lastBraceIndex);
  
  fs.writeFileSync(configPath, newConfig);
  console.log('Successfully appended mappings to config.ts');
} else {
  console.error('Could not find closing brace in config.ts');
  process.exit(1);
}
