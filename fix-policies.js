/**
 * Script para hacer todas las políticas RLS idempotentes
 * Agrega DROP POLICY IF EXISTS antes de cada CREATE POLICY
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patrón para encontrar CREATE POLICY
const CREATE_POLICY_REGEX = /^(\s*)(CREATE POLICY\s+"([^"]+)"\s+ON\s+([^\s]+))/gm;

function fixPoliciesInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Buscar CREATE POLICY que no tenga DROP POLICY antes
    if (line.match(/^\s*CREATE POLICY\s+"([^"]+)"/)) {
      const match = line.match(/^\s*CREATE POLICY\s+"([^"]+)"\s+ON\s+([^\s]+)/);
      if (match) {
        const policyName = match[1];
        const tableName = match[2];
        
        // Verificar si ya hay un DROP POLICY antes (en las últimas 5 líneas)
        let hasDrop = false;
        for (let j = Math.max(0, newLines.length - 5); j < newLines.length; j++) {
          if (newLines[j].includes(`DROP POLICY IF EXISTS "${policyName}"`) && 
              newLines[j].includes(`ON ${tableName}`)) {
            hasDrop = true;
            break;
          }
        }
        
        if (!hasDrop) {
          // Agregar DROP POLICY IF EXISTS antes
          const indent = line.match(/^(\s*)/)[1];
          newLines.push(`${indent}DROP POLICY IF EXISTS "${policyName}" ON ${tableName};`);
          modified = true;
        }
      }
    }
    
    newLines.push(line);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    return true;
  }
  
  return false;
}

// Buscar todos los archivos SQL
const sqlFiles = glob.sync('supabase_*.sql', { cwd: __dirname });

console.log(`📋 Encontrados ${sqlFiles.length} archivos SQL\n`);

let fixedCount = 0;
for (const file of sqlFiles) {
  const filePath = path.join(__dirname, file);
  try {
    if (fixPoliciesInFile(filePath)) {
      console.log(`✅ Corregido: ${file}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`❌ Error en ${file}:`, error.message);
  }
}

console.log(`\n📊 Total de archivos corregidos: ${fixedCount}`);
