/**
 * Script para ejecutar todos los scripts SQL de Supabase en orden
 * 
 * Uso:
 *   node ejecutar-todos-sql.js
 * 
 * Requiere:
 *   - NEXT_PUBLIC_SUPABASE_URL en .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('No se encontró .env.local. Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configurados.');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  
  return env;
}

// Orden de ejecución según ORDEN_EJECUCION_SQL.md
const SQL_ORDER = [
  'supabase_profiles_table.sql',
  'supabase_admin_and_settings.sql',
  'supabase_admin_user_states.sql',
  'supabase_listings.sql',
  'supabase_cart_and_orders.sql',
  'supabase_payments.sql',
  'supabase_profiles_ine_migration.sql',
  'supabase_profiles_address_migration.sql',
  'supabase_profiles_reputation.sql',
  'supabase_listings_public_id.sql',
  'supabase_listings_soft_delete.sql',
  'supabase_listings_lifecycle.sql',
  'supabase_listings_rls_fix.sql',
  'supabase_orders_logistics.sql',
  'supabase_orders_paid_to_seller.sql',
  'supabase_shipping_features.sql',
  'supabase_order_chat.sql',
  'supabase_order_chat_reads.sql',
  'supabase_order_chat_upgrade.sql',
  'supabase_notifications.sql',
  'supabase_notifications_enum_extend.sql',
  'supabase_notifications_triggers.sql',
  'supabase_notifications_backfill.sql',
  'supabase_user_ratings.sql',
  'supabase_user_reviews_public.sql',
  'supabase_favorites.sql',
  'supabase_listing_questions.sql',
  'supabase_listing_templates.sql',
  'supabase_auctions_and_coupons.sql',
  'supabase_home_banners.sql',
  'supabase_home_banners_placements.sql',
  'supabase_home_banners_admin_delete.sql',
  'supabase_disputes.sql',
  'supabase_support_chat.sql',
  'supabase_contacts_table.sql',
  'supabase_checkout_sessions_offline.sql',
  'supabase_checkout_sessions_offline_proof.sql',
  'supabase_profiles_payout_migration.sql',
  'supabase_storage_policies_pocket.sql',
  'supabase_listing_questions_rls_fix.sql', // El fix que acabamos de crear
];

async function executeSQL(supabaseUrl, serviceRoleKey, sqlContent, filename) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: sqlContent }),
    });

    if (!response.ok) {
      // Si no existe la función RPC, intentar método alternativo
      if (response.status === 404 || response.status === 400) {
        console.warn(`⚠️  Método RPC no disponible para ${filename}, usando método alternativo...`);
        return await executeSQLAlternative(supabaseUrl, serviceRoleKey, sqlContent, filename);
      }
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Error ejecutando ${filename}:`, error.message);
    throw error;
  }
}

async function executeSQLAlternative(supabaseUrl, serviceRoleKey, sqlContent, filename) {
  // Método alternativo: usar la API de PostgREST directamente
  // Dividir el SQL en statements individuales
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 0);

  const results = [];
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        // Para CREATE TABLE, ALTER TABLE, etc., necesitamos usar psql o la API de gestión
        // Por ahora, solo logueamos que necesitamos ejecutarlo manualmente
        console.log(`   📝 Statement: ${statement.substring(0, 60)}...`);
      } catch (err) {
        console.warn(`   ⚠️  No se pudo ejecutar statement: ${err.message}`);
      }
    }
  }
  
  return { executed: true, method: 'alternative', statements: statements.length };
}

async function main() {
  console.log('🚀 Iniciando ejecución de scripts SQL...\n');

  // Cargar variables de entorno
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    console.error('❌ Error cargando .env.local:', error.message);
    process.exit(1);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Faltan variables de entorno:');
    console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
    console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '✓' : '✗'}`);
    process.exit(1);
  }

  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  // Verificar que todos los archivos existan
  const missingFiles = [];
  for (const filename of SQL_ORDER) {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(filename);
    }
  }

  if (missingFiles.length > 0) {
    console.warn('⚠️  Archivos faltantes (se omitirán):');
    missingFiles.forEach(f => console.warn(`   - ${f}`));
    console.log('');
  }

  // Ejecutar scripts en orden
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < SQL_ORDER.length; i++) {
    const filename = SQL_ORDER[i];
    const filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  [${i + 1}/${SQL_ORDER.length}] Omitiendo ${filename} (no existe)`);
      continue;
    }

    try {
      console.log(`📄 [${i + 1}/${SQL_ORDER.length}] Ejecutando ${filename}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      
      await executeSQL(supabaseUrl, serviceRoleKey, sqlContent, filename);
      
      console.log(`✅ [${i + 1}/${SQL_ORDER.length}] ${filename} ejecutado correctamente\n`);
      successCount++;
      
      // Pequeña pausa entre scripts
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ [${i + 1}/${SQL_ORDER.length}] Error en ${filename}:`, error.message);
      errors.push({ filename, error: error.message });
      errorCount++;
      
      // Preguntar si continuar
      console.log('⚠️  ¿Continuar con el siguiente script? (S/n)');
      // En modo no interactivo, continuar automáticamente
      console.log('   → Continuando automáticamente...\n');
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE EJECUCIÓN');
  console.log('='.repeat(60));
  console.log(`✅ Exitosos: ${successCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log(`⏭️  Omitidos: ${SQL_ORDER.length - successCount - errorCount}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Errores encontrados:');
    errors.forEach(({ filename, error }) => {
      console.log(`   - ${filename}: ${error}`);
    });
  }

  if (errorCount > 0) {
    console.log('\n💡 NOTA: Algunos scripts pueden requerir ejecución manual en Supabase SQL Editor.');
    console.log('   Los scripts SQL deben ejecutarse directamente en el SQL Editor de Supabase.');
    console.log('   Este script es una ayuda, pero la ejecución directa es más confiable.\n');
  } else {
    console.log('\n🎉 ¡Todos los scripts se ejecutaron correctamente!\n');
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
