import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Validar autenticación vía Header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verificar rol de Admin
    const admin = supabaseAdmin();
    
    // Verificar si es admin
    const { data: adminUser, error: adminErr } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (adminErr || !adminUser) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 3. Obtener datos
    const body = await request.json();
    const { topupId } = body;

    if (!topupId) {
      return NextResponse.json({ error: 'Missing topupId' }, { status: 400 });
    }

    // 4. Buscar topup
    const { data: topup, error: fetchError } = await admin
      .from('wallet_topups')
      .select('*')
      .eq('id', topupId)
      .single();

    if (fetchError || !topup) {
      return NextResponse.json({ error: 'Topup not found' }, { status: 404 });
    }

    if (topup.status === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an approved topup' }, { status: 400 });
    }

    // 5. Rechazar topup
    const { error: updateError } = await admin
      .from('wallet_topups')
      .update({ 
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', topupId);

    if (updateError) {
      console.error('[ADMIN TOPUP REJECT] Error updating status:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[ADMIN TOPUP REJECT] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
