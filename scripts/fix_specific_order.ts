
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSpecificOrder() {
  const listingId = 'a3ea1c9a-2993-4ceb-bc58-b73c8b722bea';
  console.log(`Searching for order for listing: ${listingId}`);

  // Get Listing
  const { data: listing, error: lError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();
  
  if (lError) {
    console.error('Error fetching listing:', lError);
    return;
  }
  
  console.log('Listing found:', {
    id: listing.id,
    title: listing.title,
    weight: listing.weight_kg,
    shipping_price: listing.shipping_price,
    shipping_option_id: listing.shipping_option_id
  });

  // Get Order Item
  const { data: items, error: iError } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('listing_id', listingId);

  if (iError || !items || items.length === 0) {
    console.error('Order item not found');
    return;
  }

  const orderId = items[0].order_id;
  console.log(`Found Order ID: ${orderId}`);

  // Get Order
  const { data: order, error: oError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (oError) {
    console.error('Error fetching order:', oError);
    return;
  }

  console.log('Current Order:', {
    id: order.id,
    subtotal: order.subtotal,
    shipping_fee: order.shipping_fee,
    total: order.total,
    status: order.status
  });

  // Calculate correct shipping (assuming 40kg -> $355)
  // Check if we should update
  if (order.shipping_fee === 175) {
    const newShippingFee = 355;
    const newTotal = order.subtotal + newShippingFee;
    
    console.log(`Updating shipping fee from ${order.shipping_fee} to ${newShippingFee}`);
    console.log(`Updating total from ${order.total} to ${newTotal}`);

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_fee: newShippingFee,
        total: newTotal
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
    } else {
      console.log('✅ Order updated successfully!');
    }
  } else {
    console.log('Order shipping fee is not 175, skipping update.');
  }
}

fixSpecificOrder();
