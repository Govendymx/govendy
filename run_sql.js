const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const correctOrder = [
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
  'supabase_listing_questions_rls_fix.sql',
  'supabase_notifications_triggers.sql',
  'supabase_notifications_backfill.sql'
];

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:Govendy031187.@db.qclnkkvwevopshzflzuc.supabase.co:5432/postgres'
  });
  
  try {
    await client.connect();
    console.log('Connected to DB');

    let successCount = 0;
    for (const file of correctOrder) {
      console.log('Running ' + file);
      try {
        const sql = fs.readFileSync(path.join('../Pocket-App', file), 'utf8');
        await client.query(sql);
        console.log('Success: ' + file);
        successCount++;
      } catch (e) {
        console.error('Error in ' + file + ':', e.message);
        process.exit(1);
      }
    }

    const migDir = './supabase/migrations';
    const migs = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of migs) {
      console.log('Running migration: ' + file);
      try {
        const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
        await client.query(sql);
        console.log('Success: ' + file);
        successCount++;
      } catch (e) {
        console.error('Error in migration ' + file + ':', e.message);
        process.exit(1);
      }
    }

    await client.end();
    console.log('ALL DONE! Total files executed: ' + successCount);
  } catch (error) {
    console.error('Connection failed: ', error.message);
  }
}
run();
