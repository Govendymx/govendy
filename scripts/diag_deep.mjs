import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
readFileSync('.env.local', 'utf-8').split('\n').forEach(l => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i < 0) return;
    let val = t.substring(i + 1).trim();
    if (val.length >= 2 && ((val[0] === '"' && val[val.length - 1] === '"') || (val[0] === "'" && val[val.length - 1] === "'")))
        val = val.substring(1, val.length - 1);
    env[t.substring(0, i).trim()] = val;
});

const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

// ANON client (what the browser uses)
const anon = createClient(url, anonKey);
// ADMIN client (bypasses RLS)
const admin = createClient(url, serviceKey);

const testListingId = 'af7679a2-43af-4739-9711-e861206170a5';
const testSellerId = '9a8ae70d-5500-4976-a315-688850781ab0';

console.log('=== DEEP DIAGNOSTIC ===\n');

// 1. Does the listing exist at all? (admin, bypasses RLS)
console.log('--- 1. Listing exists? (ADMIN, no RLS) ---');
const r1 = await admin.from('listings').select('id,title,status,seller_id').eq('id', testListingId).maybeSingle();
console.log('Error:', JSON.stringify(r1.error));
console.log('Data:', r1.data ? `${r1.data.title} | status=${r1.data.status} | seller=${r1.data.seller_id}` : 'NULL');

// 2. Can ANON read this listing? (this is what the browser does)
console.log('\n--- 2. Same listing via ANON (with RLS) ---');
const r2 = await anon.from('listings').select('id,title,status').eq('id', testListingId).maybeSingle();
console.log('Error:', JSON.stringify(r2.error));
console.log('Data:', r2.data ? `${r2.data.title} | status=${r2.data.status}` : 'NULL (RLS blocking?)');

// 3. Can ANON read ANY active listing?
console.log('\n--- 3. Any active listing via ANON ---');
const r3 = await anon.from('listings').select('id,title,status').eq('status', 'active').limit(3);
console.log('Error:', JSON.stringify(r3.error));
console.log('Count:', r3.data?.length);
if (r3.data) r3.data.forEach(d => console.log(` - ${d.id.substring(0, 8)}... ${d.title?.substring(0, 40)} [${d.status}]`));

// 4. Total count via ANON
console.log('\n--- 4. Total active count via ANON ---');
const r4 = await anon.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active');
console.log('Error:', JSON.stringify(r4.error));
console.log('Count:', r4.count);

// 5. Total count via ADMIN
console.log('\n--- 5. Total active count via ADMIN ---');
const r5 = await admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active');
console.log('Error:', JSON.stringify(r5.error));
console.log('Count:', r5.count);

// 6. Check RLS policies on listings
console.log('\n--- 6. RLS policies on listings ---');
const r6 = await admin.rpc('exec_sql', { sql: "SELECT policyname, cmd, permissive, roles, qual FROM pg_policies WHERE tablename = 'listings' ORDER BY policyname" }).maybeSingle();
if (r6.error) {
    // exec_sql may not exist, try raw query
    console.log('exec_sql not available, checking via information_schema...');
    const r6b = await admin.from('listings').select('id', { count: 'exact', head: true });
    console.log('Admin can read:', !r6b.error, 'count:', r6b.count);
} else {
    console.log(JSON.stringify(r6.data, null, 2));
}

// 7. Check if RLS is enabled on listings
console.log('\n--- 7. RLS enabled check ---');
const r7 = await admin.rpc('exec_sql', { sql: "SELECT relrowsecurity FROM pg_class WHERE relname = 'listings'" });
if (r7.error) {
    console.log('Cannot check RLS status directly. Error:', r7.error.message);
} else {
    console.log('RLS enabled:', JSON.stringify(r7.data));
}

// 8. Seller listings via ANON 
console.log('\n--- 8. Seller listings via ANON ---');
const r8 = await anon.from('listings').select('id,title,status').eq('seller_id', testSellerId).eq('status', 'active').limit(3);
console.log('Error:', JSON.stringify(r8.error));
console.log('Count:', r8.data?.length);
if (r8.data) r8.data.forEach(d => console.log(` - ${d.title?.substring(0, 40)}`));

// 9. Seller listings via ADMIN
console.log('\n--- 9. Seller listings via ADMIN ---');
const r9 = await admin.from('listings').select('id,title,status').eq('seller_id', testSellerId).limit(5);
console.log('Error:', JSON.stringify(r9.error));
console.log('Count:', r9.data?.length);
if (r9.data) r9.data.forEach(d => console.log(` - ${d.title?.substring(0, 40)} [${d.status}]`));

// 10. Fetch the homepage baseListingSelect via ANON (exactly like the homepage does)
console.log('\n--- 10. Homepage query replica via ANON ---');
const baseListingSelect = 'id,title,description,price,images,public_id,sale_type,condition,free_shipping,seller_id,stock';
const r10 = await anon.from('listings').select(baseListingSelect).eq('status', 'active').order('created_at', { ascending: false }).limit(3);
console.log('Error:', JSON.stringify(r10.error));
console.log('Count:', r10.data?.length);
if (r10.data) r10.data.forEach(d => console.log(` - ${d.title?.substring(0, 40)} $${d.price}`));

process.exit(0);
