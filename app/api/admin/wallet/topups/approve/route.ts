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
      return NextResponse.json({ ok: true, message: 'Topup ya aprobado' });
    }

    // 4.1 Idempotencia fuerte por transacción existente (soporta esquema viejo y nuevo)
    const { data: existingTx } = await admin
      .from('wallet_transactions')
      .select('id')
      .eq('wallet_id', topup.user_id)
      .eq('type', 'credit')
      .eq('reference_type', 'manual_adjustment')
      .in('reference_id', [String(topup.id), `topup:${topup.id}`])
      .maybeSingle();
    if (existingTx) {
      await admin.from('wallet_topups').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', topupId);
      return NextResponse.json({ ok: true, message: 'Transacción ya existe (idempotente)' });
    }

    // 5. Acreditar saldo
    const { WalletService } = await import('@/lib/services/wallet/wallet.service');

    await WalletService.addFunds(
      topup.user_id,
      Number(topup.amount),
      `Recarga de saldo (Ref: ${topup.id.slice(0, 8)}) - Aprobado Manualmente`,
      'manual_adjustment',
      `topup:${topup.id}`
    );

    // 6. Actualizar estado del topup
    const { error: updateError } = await admin
      .from('wallet_topups')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', topupId);

    if (updateError) {
      console.error('[ADMIN TOPUP APPROVE] Error updating status:', updateError);
      return NextResponse.json({ error: 'Funds added but status update failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('[ADMIN TOPUP APPROVE] Error:', error);
    const message = typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
