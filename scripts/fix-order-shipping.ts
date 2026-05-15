/**
 * One-time script to fix order 371e24b1-8519-413e-a61e-89a92a5dbe72
 * The order status was 'paid' but should be 'shipped' since the seller uploaded the guide.
 * 
 * Run: npx tsx scripts/fix-order-shipping.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixOrder() {
  const ORDER_ID = '371e24b1-8519-413e-a61e-89a92a5dbe72';

  // 1. Fetch current order
  const { data: order, error: fetchErr } = await admin
    .from('orders')
    .select('id, status, shipping_by_seller, delivery_proof_url, tracking_number, shipped_at')
    .eq('id', ORDER_ID)
    .single();

  if (fetchErr || !order) {
    console.error('Could not fetch order:', fetchErr?.message);
    process.exit(1);
  }

  console.log('Current order:', order);

  if (order.status === 'shipped' || order.status === 'delivered') {
    console.log('Order already has correct status:', order.status);
    return;
  }

  // The seller already uploaded the guide, so status should be 'shipped'
  const now = new Date().toISOString();
  const patch: any = {
    status: 'shipped',
    shipped_at: now,
  };

  // Set tracking placeholder if missing
  if (!order.tracking_number) {
    patch.tracking_number = 'ENVIO_VENDEDOR';
  }

  console.log('Applying fix:', patch);

  const { error: updateErr } = await admin
    .from('orders')
    .update(patch)
    .eq('id', ORDER_ID);

  if (updateErr) {
    console.error('Failed to update order:', updateErr.message);
    process.exit(1);
  }

  console.log('✅ Order status fixed to shipped!');

  // 3. Verify
  const { data: updated } = await admin
    .from('orders')
    .select('id, status, shipped_at, tracking_number, delivery_proof_url')
    .eq('id', ORDER_ID)
    .single();

  console.log('Updated order:', updated);
}

fixOrder().catch(console.error);
