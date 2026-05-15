import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

console.log('URL:', url?.substring(0, 30) + '...');
console.log('KEY length:', key?.length);

const supabase = createClient(url, key);

// Test 1: Simple query with the exact same select as homepage
const baseListingSelect = 'id,title,description,price,images,public_id,sale_type,condition,free_shipping,seller_id,stock';

console.log('\n--- Test 1: baseListingSelect ---');
const r1 = await supabase.from('listings').select(baseListingSelect).eq('status', 'active').limit(2);
console.log('Error:', JSON.stringify(r1.error));
console.log('Count:', r1.data?.length);
if (r1.data?.[0]) console.log('Keys:', Object.keys(r1.data[0]).join(', '));

// Test 2: is_featured column
console.log('\n--- Test 2: is_featured filter ---');
const r2 = await supabase.from('listings').select('id').eq('status', 'active').eq('is_featured', true).limit(1);
console.log('Error:', JSON.stringify(r2.error));
console.log('Count:', r2.data?.length);

// Test 3: Minimal query to see if listings table works at all
console.log('\n--- Test 3: Minimal query ---');
const r3 = await supabase.from('listings').select('id,title,price,status').limit(3);
console.log('Error:', JSON.stringify(r3.error));
console.log('Count:', r3.data?.length);
if (r3.data) r3.data.forEach(d => console.log(' -', d.id?.substring(0, 8), d.title?.substring(0, 30), d.status, d.price));

// Test 4: Check RLS - try anon access
console.log('\n--- Test 4: Check total listing count ---');
const r4 = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active');
console.log('Error:', JSON.stringify(r4.error));
console.log('Total active listings:', r4.count);

process.exit(0);
