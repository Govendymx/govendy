import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const checkInconsistencies = searchParams.get('check_inconsistencies');

  const supabase = supabaseAdmin();

  try {
    // Allow fixing a specific order by ID
    const fixId = searchParams.get('fix_id');
    if (fixId) {
       const { error: updateError } = await supabase
         .from('orders')
         .update({ status: 'delivered' } as any)
         .eq('id', fixId);
         
       if (updateError) {
         return NextResponse.json({ error: updateError.message }, { status: 500 });
       }
       return NextResponse.json({ message: `Fixed order ${fixId} to status 'delivered'` });
    }

    if (checkInconsistencies) {
      const fix = searchParams.get('fix') === 'true';
      
      // Find orders that are paid to seller but not delivered/completed
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('paid_to_seller_at', 'is', null)
        .neq('status', 'delivered');

      if (error) throw error;

      if (fix && data && data.length > 0) {
        const ids = data.map((o: any) => o.id);
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'delivered' } as any)
          .in('id', ids);
          
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        return NextResponse.json({ 
          message: `Fixed ${ids.length} orders`, 
          fixed_ids: ids,
          inconsistent_orders: data 
        });
      }

      return NextResponse.json({ inconsistent_orders: data });
    }

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Fetch last 100 orders to find the one matching the partial ID
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Database Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter in memory
    const filteredOrders = data.filter((order: any) => order.id.startsWith(id));

    return NextResponse.json({ orders: filteredOrders });
  } catch (err: any) {
    console.error('Catch Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
