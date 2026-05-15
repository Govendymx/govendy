const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function main() {
    const { data, error } = await admin.storage.listBuckets();
    if (error) {
        console.error('Error listing buckets:', error.message);
        return;
    }
    console.log('Available buckets:');
    for (const b of (data || [])) {
        console.log(`  - "${b.name}" (id: ${b.id}, public: ${b.public})`);
    }
}

main().catch(console.error);
