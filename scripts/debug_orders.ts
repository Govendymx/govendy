
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

async function debugOrders() {
  console.log('--- Debugging Orders Table ---');

  // 1. List Triggers
  console.log('\n1. Triggers on public.orders:');
  const { data: triggers, error: trigError } = await admin
    .rpc('get_triggers', { table_name: 'orders' }); // This might not exist.
  
  // Alternative: Query information_schema directly if allowed (usually not via client unless RLS off or postgres user)
  // But we can try to inspect via a custom SQL function if we could create one. 
  // Since we can't easily create functions without knowing if we have permissions (we do have service role),
  // let's try to infer from behavior.
  
  // Better: Try to update a dummy order.
  
  // Create a dummy order
  console.log('\n2. Creating dummy order...');
  const { data: user } = await admin.auth.getUser(); // This gets the "service_role" user? No, service role has no user.
  // We need a valid buyer_id and seller_id.
  // Let's pick the first user we find.
  const { data: users } = await admin.from('profiles').select('id').limit(1);
  if (!users || users.length === 0) {
    console.log('No users found.');
    return;
  }
  const userId = users[0].id;
  
  const { data: order, error: createError } = await admin
    .from('orders')
    .insert({
      buyer_id: userId,
      seller_id: userId, // Buying from self is usually allowed for testing
      total: 100,
      status: 'pending_payment'
    })
    .select()
    .single();
    
  if (createError) {
    console.error('Error creating order:', createError);
    return;
  }
  console.log('Order created:', order.id, order.status);
  
  // Update the order
  console.log('\n3. Updating order to paid...');
  const { data: updated, error: updateError } = await admin
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', order.id)
    .select()
    .single();
    
  if (updateError) {
    console.error('Error updating order:', updateError);
  } else {
    console.log('Update result:', updated.status);
    if (updated.status !== 'paid') {
      console.error('CRITICAL: Status did not update!');
    } else {
      console.log('Update successful.');
    }
  }
  
  // Cleanup
  console.log('\n4. Cleaning up...');
  await admin.from('orders').delete().eq('id', order.id);
}

debugOrders();
