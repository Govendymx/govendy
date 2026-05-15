
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manual dotenv parsing
const envPath = path.join(process.cwd(), '.env.local');
console.log('Reading env from:', envPath);

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
      process.env[key] = value;
    }
  });
} else {
  console.log('Env file not found');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars:', { supabaseUrl, hasKey: !!supabaseServiceKey });
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

async function debugRPC() {
  console.log('--- Debugging RPC update_checkout_session_atomic ---');

  // 1. Create dummy order and session
  console.log('\n1. Creating dummy order and session...');
  
  const { data: users, error: usersError } = await admin.from('profiles').select('id').limit(1);
  if (usersError || !users || users.length === 0) {
    console.log('No users found or error:', usersError);
    return;
  }
  const userId = users[0].id;
  
  // Create Order
  const { data: order, error: createError } = await admin
    .from('orders')
    .insert({
      buyer_id: userId,
      seller_id: userId, 
      total: 100,
      status: 'pending_payment'
    })
    .select()
    .single();
    
  if (createError) {
    console.error('Error creating order:', createError);
    return;
  }
  console.log('Order created:', order.id);

  // Create Session
  const { data: session, error: sessError } = await admin
    .from('checkout_sessions')
    .insert({
      buyer_id: userId,
      order_ids: [order.id],
      status: 'pending',
      payment_method: 'offline',
      amount: 100
    })
    .select()
    .single();

  if (sessError) {
    console.error('Error creating session:', sessError);
    await admin.from('orders').delete().eq('id', order.id);
    return;
  }
  console.log('Session created:', session.id);

  // 2. Call RPC
  console.log('\n2. Calling update_checkout_session_atomic...');
  const { data: rpcData, error: rpcError } = await admin.rpc('update_checkout_session_atomic', {
    p_checkout_id: session.id,
    p_admin_id: userId, // pretending to be admin
    p_action: 'mark_paid',
    p_admin_name: 'Debug Script'
  });

  if (rpcError) {
    console.error('RPC Error:', rpcError);
  } else {
    console.log('RPC Result:', rpcData);
  }

  // 3. Verify
  const { data: verifiedOrder } = await admin.from('orders').select('status, paid_at').eq('id', order.id).single();
  console.log('Verified Order:', verifiedOrder);

  // 4. Cleanup
  console.log('\n4. Cleaning up...');
  await admin.from('checkout_sessions').delete().eq('id', session.id);
  await admin.from('orders').delete().eq('id', order.id);
}

debugRPC();
