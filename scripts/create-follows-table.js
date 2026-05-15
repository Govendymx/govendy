const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function main() {
    console.log('Creating follows table...');

    // Create table via raw SQL using rpc
    const { error: tableErr } = await admin.rpc('exec_sql', {
        sql: `
      CREATE TABLE IF NOT EXISTS follows (
        follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (follower_id, seller_id)
      );
      CREATE INDEX IF NOT EXISTS idx_follows_seller ON follows(seller_id);
      CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    `
    });

    if (tableErr) {
        console.log('RPC exec_sql not available, trying direct insert to test table existence...');

        // Try inserting directly — if table doesn't exist, it will error
        const { error: testErr } = await admin
            .from('follows')
            .select('follower_id')
            .limit(1);

        if (testErr && testErr.message?.includes('does not exist')) {
            console.error('❌ Table "follows" does not exist. Please create it manually in Supabase SQL Editor.');
            console.log('\nRun this SQL in your Supabase Dashboard > SQL Editor:\n');
            console.log(`
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_seller ON follows(seller_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);
      `);
        } else if (testErr) {
            console.error('Error testing table:', testErr.message);
        } else {
            console.log('✅ Table "follows" already exists!');
        }
    } else {
        console.log('✅ Table created successfully!');
    }
}

main().catch(console.error);
