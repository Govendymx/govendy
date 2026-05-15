const { createClient } = require('@supabase/supabase-js');

async function main() {
  const id = process.argv[2];
  const dry = process.argv.includes('--dry');
  if (!id) {
    console.error('Usage: node scripts/fix-order-shipping.js <orderId> [--dry]');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(2);
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: order, error } = await admin
    .from('orders')
    .select('id, subtotal, total, commission_fee, shipping_fee, shipping_subsidy, shipping_option_id, shipping_carrier, shipping_label_url, shipping_by_seller, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !order) {
    console.error('Order fetch error:', error?.message || 'not found');
    process.exit(3);
  }

  const { data: items, error: itErr } = await admin
    .from('order_items')
    .select('order_id, listings!inner(id, shipping_by_seller)')
    .eq('order_id', id);
  if (itErr) {
    console.error('Items fetch error:', itErr.message);
    process.exit(4);
  }

  const hasSelfShippingListing = (items || []).some((it) => Boolean(it?.listings?.shipping_by_seller));

  const opt = String(order.shipping_option_id || '').trim().toLowerCase();
  const carr = String(order.shipping_carrier || '').trim().toLowerCase();
  const pickup = opt === 'pickup' || carr === 'pickup';
  const hasSignals =
    (!pickup && Boolean(opt) && opt !== 'pickup') ||
    (!pickup && carr === 'gopocket') ||
    Boolean(order.shipping_label_url) ||
    Number(order.shipping_subsidy || 0) > 0 ||
    (!pickup && Number(order.shipping_fee || 0) > 0);

  const desiredBySeller = !pickup && hasSelfShippingListing && !hasSignals;
  const currentBySeller = Boolean(order.shipping_by_seller);

  console.log(JSON.stringify({
    id,
    currentBySeller,
    desiredBySeller,
    pickup,
    hasSelfShippingListing,
    hasSignals,
    shipping_fee: order.shipping_fee,
    shipping_subsidy: order.shipping_subsidy
  }, null, 2));

  if (!dry && currentBySeller !== desiredBySeller) {
    const { error: upErr } = await admin
      .from('orders')
      .update({ shipping_by_seller: desiredBySeller })
      .eq('id', id);
    if (upErr) {
      console.error('Update error:', upErr.message);
      process.exit(5);
    }
    console.log('Updated shipping_by_seller ->', desiredBySeller);
  } else {
    console.log('No update needed.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});

