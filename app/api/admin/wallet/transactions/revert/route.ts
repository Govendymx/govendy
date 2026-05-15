import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user } } = await authClient.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!adminRow) {
      const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const txId: string | undefined = body?.transactionId || body?.txId;
    const reason: string = String(body?.reason || '').slice(0, 140);
    if (!txId) {
      return NextResponse.json({ error: 'Falta transactionId' }, { status: 400 });
    }

    const { data: tx, error: txErr } = await admin
      .from('wallet_transactions')
      .select('*')
      .eq('id', txId)
      .single();
    if (txErr || !tx) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 });
    }

    if (tx.reference_type === 'manual_adjustment' && String(tx.reference_id || '').startsWith('reversal:')) {
      return NextResponse.json({ error: 'Esta transacción ya es un reverso' }, { status: 400 });
    }

    const reversalRef = `reversal:${tx.id}`;
    const { data: exists } = await admin
      .from('wallet_transactions')
      .select('id')
      .eq('wallet_id', tx.wallet_id)
      .eq('reference_type', 'manual_adjustment')
      .eq('reference_id', reversalRef)
      .maybeSingle();
    if (exists) {
      return NextResponse.json({ ok: true, message: 'Reverso ya aplicado', reversalId: exists.id });
    }

    const { WalletService } = await import('@/lib/services/wallet/wallet.service');

    const conceptBase = `Reverso de ${String(tx.id).slice(0, 8)}${tx.concept ? ` · ${String(tx.concept).slice(0, 60)}` : ''}`;
    const concept = reason ? `${conceptBase} · ${reason}` : conceptBase;

    let reversal: any;
    if (tx.type === 'credit') {
      reversal = await WalletService.deductFunds(tx.wallet_id, Number(tx.amount), concept, 'manual_adjustment', reversalRef);
    } else if (tx.type === 'debit') {
      reversal = await WalletService.addFunds(tx.wallet_id, Number(tx.amount), concept, 'manual_adjustment', reversalRef);
    } else {
      return NextResponse.json({ error: 'Tipo de transacción no soportado' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, reversal });
  } catch (e: any) {
    console.error('[ADMIN WALLET REVERT]', e);
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}

