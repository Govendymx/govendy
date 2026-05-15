// Simular exactamente lo que hace ventas/page.tsx pero con admin
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(
  'https://xlnxdzocwgrzqoznmarc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY'
);

async function test() {
  const oids = ['2efc6416-2680-4ee0-99cc-9bcda69efad8', '09dbcb5a-7540-4fae-b198-a493cb54f7e2'];

  // 1. Simulate the exact query from ventas page
  const part = await admin
    .from('order_items')
    .select('order_id,listing_id,title,quantity,line_total,selected_size,selected_color,listings(title,images,sale_type)')
    .in('order_id', oids);

  console.log('=== order_items query ===');
  console.log('Error:', part.error?.message || 'NONE');
  console.log('Count:', part.data?.length || 0);

  if (part.data) {
    for (const it of part.data) {
      const lid = String(it.listing_id || '');
      const lj = it.listings;
      console.log('\n  listing_id:', lid);
      console.log('  item.title:', String(it.title || '').slice(0, 50));
      console.log('  listings join:', lj ? 'EXISTS' : 'NULL');
      if (lj) {
        console.log('  lj.title:', String(lj.title || '').slice(0, 50));
        const imgs = Array.isArray(lj.images) ? lj.images : [];
        console.log('  lj.images count:', imgs.length);
        console.log('  first img:', imgs[0] ? String(imgs[0]).slice(0, 80) : 'NONE');
      }
    }
  }

  // 2. Now test if the listing is found by ID (same as the direct query)
  if (part.data && part.data.length > 0) {
    const lid = String(part.data[0].listing_id || '');
    console.log('\n=== Direct listing query by id ===');
    const { data: listing, error: le } = await admin
      .from('listings')
      .select('id,public_id,images,title,handling_days,shipping_by_seller')
      .eq('id', lid)
      .maybeSingle();
    console.log('Error:', le?.message || 'NONE');
    console.log('Found:', !!listing);
    if (listing) {
      const imgs = Array.isArray(listing.images) ? listing.images : [];
      console.log('title:', listing.title?.slice(0, 50));
      console.log('images count:', imgs.length);
      console.log('first img:', imgs[0] ? String(imgs[0]).slice(0, 80) : 'NONE');
    }
  }
}

test();
