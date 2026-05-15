/**
 * Script para consolidar todos los scripts SQL en un solo archivo
 * 
 * Uso:
 *   node consolidar-sql.js
 * 
 * Esto generará un archivo `TODOS_LOS_SQL_CONSOLIDADOS.sql` que puedes
 * copiar y pegar directamente en el SQL Editor de Supabase.
 */

const fs = require('fs');
const path = require('path');

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

function main() {
  console.log('📦 Consolidando todos los scripts SQL...\n');

  let consolidated = `-- ============================================================
-- Pocket App - TODOS LOS SCRIPTS SQL CONSOLIDADOS
-- ============================================================
-- Este archivo contiene todos los scripts SQL en el orden correcto
-- Generado automáticamente el ${new Date().toLocaleString('es-MX')}
-- 
-- INSTRUCCIONES:
-- 1. Abre el SQL Editor en tu proyecto de Supabase
-- 2. Copia y pega TODO este contenido
-- 3. Haz clic en "Run" o presiona Ctrl+Enter
-- 4. Espera a que termine la ejecución
-- 
-- NOTA: La mayoría de scripts son idempotentes (puedes ejecutarlos
-- múltiples veces sin problemas gracias a IF NOT EXISTS).
-- ============================================================

`;

  let successCount = 0;
  let missingCount = 0;
  const missingFiles = [];

  for (let i = 0; i < SQL_ORDER.length; i++) {
    const filename = SQL_ORDER[i];
    const filePath = path.join(__dirname, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  [${i + 1}/${SQL_ORDER.length}] ${filename} no encontrado`);
      missingFiles.push(filename);
      missingCount++;
      continue;
    }

    try {
      console.log(`📄 [${i + 1}/${SQL_ORDER.length}] Agregando ${filename}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      
      consolidated += `\n-- ============================================================\n`;
      consolidated += `-- Script ${i + 1}/${SQL_ORDER.length}: ${filename}\n`;
      consolidated += `-- ============================================================\n\n`;
      consolidated += sqlContent;
      consolidated += `\n\n`;
      
      successCount++;
    } catch (error) {
      console.error(`❌ Error leyendo ${filename}:`, error.message);
      missingFiles.push(filename);
      missingCount++;
    }
  }

  consolidated += `\n-- ============================================================\n`;
  consolidated += `-- FIN DE LA CONSOLIDACIÓN\n`;
  consolidated += `-- Scripts procesados: ${successCount}\n`;
  if (missingCount > 0) {
    consolidated += `-- Scripts faltantes: ${missingCount}\n`;
    consolidated += `-- Archivos faltantes:\n`;
    missingFiles.forEach(f => {
      consolidated += `--   - ${f}\n`;
    });
  }
  consolidated += `-- ============================================================\n`;

  // Guardar archivo consolidado
  const outputPath = path.join(__dirname, 'TODOS_LOS_SQL_CONSOLIDADOS.sql');
  fs.writeFileSync(outputPath, consolidated, 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('✅ CONSOLIDACIÓN COMPLETADA');
  console.log('='.repeat(60));
  console.log(`✅ Scripts agregados: ${successCount}`);
  if (missingCount > 0) {
    console.log(`⚠️  Scripts faltantes: ${missingCount}`);
    console.log('\nArchivos faltantes:');
    missingFiles.forEach(f => console.log(`   - ${f}`));
  }
  console.log(`\n📁 Archivo generado: ${outputPath}`);
  console.log('\n💡 INSTRUCCIONES:');
  console.log('   1. Abre el SQL Editor en tu proyecto de Supabase');
  console.log('   2. Abre el archivo TODOS_LOS_SQL_CONSOLIDADOS.sql');
  console.log('   3. Copia TODO el contenido');
  console.log('   4. Pégalo en el SQL Editor de Supabase');
  console.log('   5. Haz clic en "Run" o presiona Ctrl+Enter');
  console.log('   6. Espera a que termine la ejecución\n');
}

main();
