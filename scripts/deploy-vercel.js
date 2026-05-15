#!/usr/bin/env node

/**
 * Script para desplegar a Vercel usando token
 * 
 * Uso:
 *   node scripts/deploy-vercel.js [--token TOKEN] [--prod]
 *   
 * O con variable de entorno:
 *   VERCEL_TOKEN=tu_token node scripts/deploy-vercel.js [--prod]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parsear argumentos
const args = process.argv.slice(2);
const isProd = args.includes('--prod') || args.includes('--production');
const tokenIndex = args.findIndex(arg => arg === '--token' || arg === '-t');
const token = tokenIndex >= 0 && args[tokenIndex + 1] 
  ? args[tokenIndex + 1] 
  : process.env.VERCEL_TOKEN;

if (!token) {
  console.error('❌ Error: Se requiere un token de Vercel');
  console.error('');
  console.error('Uso:');
  console.error('  node scripts/deploy-vercel.js --token TU_TOKEN [--prod]');
  console.error('');
  console.error('O con variable de entorno:');
  console.error('  $env:VERCEL_TOKEN="TU_TOKEN"; node scripts/deploy-vercel.js [--prod]');
  console.error('');
  console.error('Para obtener tu token:');
  console.error('  1. Ve a https://vercel.com/account/tokens');
  console.error('  2. Crea un nuevo token');
  console.error('  3. Cópialo y úsalo con este script');
  process.exit(1);
}

// Verificar que estamos en el directorio correcto
const projectRoot = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  console.error('❌ Error: No se encontró package.json. Asegúrate de ejecutar desde la raíz del proyecto.');
  process.exit(1);
}

console.log('🚀 Iniciando despliegue a Vercel...\n');

try {
  // Configurar token de Vercel
  process.env.VERCEL_TOKEN = token;
  
  // Comando de despliegue
  const deployCmd = isProd 
    ? 'vercel --prod --yes --token ' + token
    : 'vercel --yes --token ' + token;
  
  console.log(`📦 Modo: ${isProd ? 'PRODUCCIÓN' : 'Preview'}`);
  console.log('⏳ Subiendo archivos y construyendo...\n');
  
  // Ejecutar despliegue
  execSync(deployCmd, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      VERCEL_TOKEN: token,
    },
  });
  
  console.log('\n✅ ¡Despliegue completado exitosamente!');
  
} catch (error) {
  console.error('\n❌ Error durante el despliegue:');
  console.error(error.message);
  process.exit(1);
}
