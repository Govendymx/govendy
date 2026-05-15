import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const admin = auth.admin;
    const userId = auth.effectiveUserId;

    const { data, error } = await admin
      .from('wallet_topups')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending_proof', 'pending_approval'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || 'Error cargando recargas pendientes' },
        { status: 500 },
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const parsed = rows.map((t: any) => {
      let metadata = t?.metadata;
      if (!metadata && typeof t?.mercadopago_preference_id === 'string') {
        const raw = t.mercadopago_preference_id.trim();
        if (raw.startsWith('{')) {
          try {
            metadata = JSON.parse(raw);
          } catch {
          }
        }
      }
      return { ...t, metadata };
    });

    return NextResponse.json({ ok: true, topups: parsed });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error interno cargando recargas pendientes' },
      { status: 500 },
    );
  }
}

