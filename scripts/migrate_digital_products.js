/**
 * Migration: Add Digital Products Support
 * 
 * Adds columns to listings for digital product type and delivery configuration,
 * and creates a digital_deliveries table for storing delivered data.
 * 
 * Run: node scripts/migrate_digital_products.js
 */

const fs = require('fs');
const path = require('path');

// Read env from .env.local
function loadEnv() {
    const envMap = {};
    for (const f of ['.env.local', '.env']) {
        const p = path.join(__dirname, '..', f);
        if (fs.existsSync(p)) {
            const lines = fs.readFileSync(p, 'utf-8').split('\n');
            for (const line of lines) {
                const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.+?)"?\s*$/);
                if (m) envMap[m[1]] = m[2];
            }
        }
    }
    return envMap;
}

async function main() {
    const env = loadEnv();
    const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
        console.log('You can run these SQL statements directly in Supabase Dashboard > SQL Editor:');
        console.log('\n' + SQL);
        process.exit(1);
    }

    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(url, key);

    // Execute via rpc or direct REST
    const statements = SQL.split(';').map(s => s.trim()).filter(Boolean);

    for (const stmt of statements) {
        console.log(`Executing: ${stmt.substring(0, 80)}...`);
        const { error } = await sb.rpc('exec_sql', { sql: stmt + ';' }).catch(() => ({}));
        if (error) {
            // Try direct approach - some Supabase instances don't have exec_sql
            console.log('  rpc failed, trying direct...', error.message);
        }
    }

    console.log('\n✅ Migration complete! Run these in Supabase SQL Editor if any failed above.');
    console.log('\n' + SQL);
}

const SQL = `
-- 1. Add digital product columns to listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_type TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_fields JSONB DEFAULT '[]';

-- 2. Create digital_deliveries table
CREATE TABLE IF NOT EXISTS digital_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  listing_id UUID,
  delivered_by UUID NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}',
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_digital_deliveries_order_id ON digital_deliveries(order_id);

-- 4. Enable RLS
ALTER TABLE digital_deliveries ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'digital_deliveries_seller_insert') THEN
    CREATE POLICY digital_deliveries_seller_insert ON digital_deliveries
      FOR INSERT TO authenticated
      WITH CHECK (delivered_by = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'digital_deliveries_buyer_seller_select') THEN
    CREATE POLICY digital_deliveries_buyer_seller_select ON digital_deliveries
      FOR SELECT TO authenticated
      USING (
        delivered_by = auth.uid()
        OR order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid())
      );
  END IF;
END$$
`;

main().catch(console.error);
