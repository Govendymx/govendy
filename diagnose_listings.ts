import { supabaseAdmin } from './lib/supabase/admin';

async function diagnose() {
    const admin = supabaseAdmin();
    const { data, error } = await admin
        .from('listings')
        .select('id, title, status, sale_type, expires_at, auction_end_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Recent Listings:');
    console.table(data);
}

diagnose();
