#!/usr/bin/env node

/**
 * Script para verificar que las variables de entorno estén configuradas
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(projectRoot, '.env.local');
const envExamplePath = path.join(projectRoot, '.env.example');

console.log('🔍 Verificando configuración de variables de entorno...\n');

// Verificar si existe .env.local
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ No se encontró .env.local');
  console.error('');
  console.error('Para solucionarlo:');
  console.error('  1. Copia .env.example a .env.local:');
  console.error('     cp .env.example .env.local');
  console.error('');
  console.error('  2. Edita .env.local y agrega tus credenciales de Supabase');
  console.error('     Obtén las credenciales en: https://app.supabase.com → Tu Proyecto → Settings → API');
  console.error('');
  process.exit(1);
}

// Leer .env.local
const envContent = fs.readFileSync(envLocalPath, 'utf8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

// Variables requeridas
const requiredVars = {
  'NEXT_PUBLIC_SUPABASE_URL': false,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': false,
  'SUPABASE_SERVICE_ROLE_KEY': false,
};

// Verificar cada variable
for (const line of envLines) {
  const [key] = line.split('=').map(s => s.trim());
  if (requiredVars.hasOwnProperty(key)) {
    const value = line.split('=').slice(1).join('=').trim();
    if (value && !value.includes('tu-') && !value.includes('TU_')) {
      requiredVars[key] = true;
    }
  }
}

// Mostrar resultados
let allOk = true;
console.log('Variables de entorno:\n');

for (const [key, isSet] of Object.entries(requiredVars)) {
  const status = isSet ? '✅' : '❌';
  const value = isSet ? 'Configurada' : 'FALTA';
  console.log(`  ${status} ${key}: ${value}`);
  if (!isSet) allOk = false;
}

console.log('');

// Validación de rol del JWT para prevenir errores críticos
try {
  const anonLine = envLines.find(l => l.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='));
  if (anonLine) {
    const token = anonLine.split('=').slice(1).join('=').trim();
    const parts = token.split('.');
    if (parts.length === 3) {
      const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : '';
      const payload = JSON.parse(Buffer.from(b + pad, 'base64').toString('utf8'));
      if (payload.role && String(payload.role).toLowerCase() !== 'anon') {
        console.error('❌ ERROR CRÍTICO: NEXT_PUBLIC_SUPABASE_ANON_KEY no es "anon".');
        console.error(`   Detectado rol: "${payload.role}"`);
        console.error('   Nunca uses la clave "service_role" como ANON. ¡Rota la clave en Supabase y corrige .env.local!');
        process.exit(1);
      }
    }
  }
} catch (e) {
  console.warn('⚠️  Advertencia al validar el rol del JWT ANON:', e.message);
}

if (!allOk) {
  console.error('❌ Faltan variables de entorno requeridas.');
  console.error('');
  console.error('Para solucionarlo:');
  console.error('  1. Abre .env.local');
  console.error('  2. Configura las variables que faltan con tus credenciales de Supabase');
  console.error('  3. Reinicia el servidor de desarrollo (npm run dev)');
  console.error('');
  console.error('Obtén tus credenciales en:');
  console.error('  https://app.supabase.com → Tu Proyecto → Settings → API');
  console.error('');
  process.exit(1);
}

console.log('✅ Todas las variables de entorno requeridas están configuradas.');
console.log('');
console.log('💡 Si aún ves errores "Failed to fetch":');
console.log('  1. Verifica que las URLs sean correctas (deben empezar con https://)');
console.log('  2. Reinicia el servidor de desarrollo: npm run dev');
console.log('  3. Verifica que tu proyecto de Supabase esté activo');
console.log('');
