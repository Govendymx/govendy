import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyMarkedDeliveredByAdminSeller } from '@/lib/email/notify';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

async function broadcastAdminLogistica(orderId: string, payload: any = {}) {
  try {
    const admin = supabaseAdmin();
    const ch: any = admin.channel('admin-logistica');
    await new Promise<void>((resolve) => {
      let done = false;
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, 1200);
      ch.subscribe((status: string) => {
        if (done) return;
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          done = true;
          clearTimeout(t);
          resolve();
        }
      });
    });
    await ch.send({ type: 'broadcast', event: 'order_updated', payload: { orderId, ...payload, t: Date.now() } });
    try {
      admin.removeChannel(ch);
    } catch {
      // noop
    }
  } catch {
    // noop
  }
}

type Body = {
  orderId: string;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
  action?: 'mark_shipped' | 'mark_delivered' | 'clear_tracking';
};

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const patch: any = {};
    if (body?.tracking_number !== undefined) patch.tracking_number = String(body.tracking_number ?? '').trim() || null;
    if (body?.shipping_carrier !== undefined) patch.shipping_carrier = String(body.shipping_carrier ?? '').trim() || null;

    const action = body?.action;
    if (action === 'clear_tracking') {
      patch.tracking_number = null;
      patch.shipping_carrier = null;
      patch.shipped_at = null;
    }
    if (action === 'mark_shipped') {
      patch.shipped_at = new Date().toISOString();
      patch.status = 'shipped';
    }
    if (action === 'mark_delivered') {
      const now = new Date().toISOString();
      patch.delivered_at = now;
      patch.status = 'delivered';
      // Liberar pago al vendedor: mismo criterio que confirm-received.
      // Solo actualizar si paid_to_seller_at es null (no sobrescribir, estabilidad).
      const { data: row } = await admin.from('orders').select('paid_to_seller_at').eq('id', orderId).maybeSingle();
      if (row && !(row as any)?.paid_to_seller_at) {
        (patch as any).paid_to_seller_at = now;
        (patch as any).paid_to_seller_by = guard.requesterId;
      }
    }

    let sellerId: string | null = null;
    if (action === 'mark_delivered') {
      const { data: ord } = await admin.from('orders').select('seller_id').eq('id', orderId).maybeSingle();
      sellerId = ord ? String((ord as any)?.seller_id ?? '').trim() || null : null;
    }

    const upd: any = await admin.from('orders').update(patch).eq('id', orderId);
    if (upd.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        return NextResponse.json({ error: 'Faltan columnas de logística en `orders`. Ejecuta `supabase_orders_logistics.sql`.' }, { status: 400 });
      }
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    if (action === 'mark_delivered' && sellerId) {
      void notifyMarkedDeliveredByAdminSeller({ sellerId, orderId }).catch((e) =>
        console.warn('[logistica/order/update] email notifyMarkedDeliveredByAdminSeller:', e)
      );
    }

    // --- CASHBACK LOGIC START ---
    if (action === 'mark_delivered') {
      try {
        const amount = await WalletService.processOrderCashback(orderId);
        if (amount > 0) {
           console.log(`[Cashback] Added $${amount} to user via processOrderCashback for order ${orderId}`);
        }
      } catch (err) {
        console.error('[Cashback] Error processing cashback:', err);
      }
    }
    // --- CASHBACK LOGIC END ---

    // Best-effort: disparar update realtime para Admin → Logística (para que otros admins lo vean)
    void broadcastAdminLogistica(orderId, { kind: 'admin_order_update', action: action || null });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

