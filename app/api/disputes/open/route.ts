import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
import { notifyDisputeOpened } from '@/lib/email/notify';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function requireUserFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  return { ok: true as const, userId: userData.user.id };
}

type Body = {
  orderId: string;
  reason_code: 'not_received' | 'damaged' | 'not_as_described' | 'missing_items' | 'other';
  reason_text?: string;
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    const reason_code = String(body?.reason_code || '').trim() as Body['reason_code'];
    const reason_text = String(body?.reason_text || '').trim();

    if (!orderId || !isUuid(orderId)) return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
    if (!['not_received', 'damaged', 'not_as_described', 'missing_items', 'other'].includes(reason_code)) {
      return NextResponse.json({ error: 'reason_code inválido' }, { status: 400 });
    }
    if (reason_text.length > 600) return NextResponse.json({ error: 'reason_text demasiado largo (máx. 600).' }, { status: 400 });

    const admin = supabaseAdmin();

    // Validar orden y que sea del comprador
    const { data: o, error: oErr } = await admin.from('orders').select('id,buyer_id,seller_id,status,total').eq('id', orderId).maybeSingle();
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });
    if (!o) return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    const buyerId = String((o as any)?.buyer_id || '').trim();
    const sellerId = String((o as any)?.seller_id || '').trim();
    const status = String((o as any)?.status || '').trim();
    if (!buyerId || !sellerId) return NextResponse.json({ error: 'Orden inválida (sin buyer/seller).' }, { status: 400 });
    if (buyerId !== guard.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    // Evitar duplicados: si ya existe disputa para esa orden
    const existing: any = await admin.from('disputes').select('id,order_id,status').eq('order_id', orderId).maybeSingle();
    if (!existing?.error && existing?.data?.id) {
      return NextResponse.json({ ok: true, disputeId: String(existing.data.id), already: true });
    }

    // Insertar disputa
    const ins: any = await admin
      .from('disputes')
      .insert([
        {
          order_id: orderId,
          buyer_id: buyerId,
          seller_id: sellerId,
          opened_by: buyerId,
          reason_code,
          reason_text: reason_text || '',
          status: 'open',
          last_message_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
      }
      if (code === '23505' || msg.includes('duplicate')) {
        const again: any = await admin.from('disputes').select('id').eq('order_id', orderId).maybeSingle();
        if (!again?.error && again?.data?.id) return NextResponse.json({ ok: true, disputeId: String(again.data.id), already: true });
      }
      return NextResponse.json({ error: String((ins.error as any)?.message || ins.error) }, { status: 400 });
    }

    const disputeId = String((ins.data as any)?.id || '').trim();

    // Mensaje inicial (best-effort)
    try {
      const reasonLabel =
        reason_code === 'not_received'
          ? 'No recibí mi pedido'
          : reason_code === 'damaged'
            ? 'Llegó dañado'
            : reason_code === 'not_as_described'
              ? 'No es como se describía'
              : reason_code === 'missing_items'
                ? 'Faltan artículos'
                : 'Otro';
      await admin.from('dispute_messages').insert([
        {
          dispute_id: disputeId,
          sender_id: buyerId,
          sender_role: 'buyer',
          body: `Disputa iniciada: ${reasonLabel}${reason_text ? `\n\nDetalle: ${reason_text}` : ''}`,
          attachments: [],
        },
      ]);
    } catch {
      // noop
    }

    // Retener dinero: marcar la orden como disputed (best-effort)
    try {
      if (status && status !== 'disputed') {
        await admin.from('orders').update({ status: 'disputed' }).eq('id', orderId);
      }
    } catch {
      // noop
    }

    // Notificaciones (best-effort) a vendedor usando sistema unificado
    try {
      const { sendUnifiedNotification } = await import('@/lib/notifications/unified');
      await sendUnifiedNotification(admin, {
        userId: sellerId,
        type: 'dispute_opened',
        title: '⚠️ Se abrió una disputa',
        body: `El comprador abrió una disputa en la orden ${orderId.slice(0, 8)}…`,
        data: { disputeId, orderId },
        linkTo: `/dashboard/ventas?order=${orderId}`,
        channels: ['both'],
        priority: 'urgent',
      });
    } catch {
      // Fallback a método anterior
      try {
        const { insertNotificationBestEffort } = await import('@/lib/notifications/insertBestEffort');
        await insertNotificationBestEffort(admin, {
          user_id: sellerId,
          type: 'dispute_opened',
          title: 'Se abrió una disputa',
          body: `El comprador abrió una disputa en la orden ${orderId.slice(0, 8)}…`,
          data: { disputeId, orderId },
          link_to: `/dashboard/ventas?order=${orderId}`,
          is_read: false,
        });
      } catch {
        // noop
      }
    }

    // CRÍTICO: Registrar evento para panel de admin
    try {
      const { recordAdminEvent } = await import('@/lib/admin/events');
      await recordAdminEvent(admin, {
        event_type: 'dispute_opened',
        entity_type: 'dispute',
        entity_id: disputeId,
        user_id: buyerId,
        status: 'open',
        metadata: {
          order_id: orderId,
          reason_code,
          reason_text: reason_text || '',
          buyer_id: buyerId,
          seller_id: sellerId,
        },
      });
    } catch (eventErr) {
      console.error('[disputes/open] Error registrando evento admin:', eventErr);
    }

    // Notificar a administradores
    try {
      const { notifyAdmin } = await import('@/lib/notifications/admin');
      await notifyAdmin.disputeOpened({
        disputeId,
        orderId,
        buyerId,
        sellerId,
      });
    } catch (adminNotifyErr) {
      console.error('[disputes/open] Error al notificar administradores:', adminNotifyErr);
    }

    try {
      const { sendUnifiedNotification } = await import('@/lib/notifications/unified');
      await sendUnifiedNotification(admin, {
        userId: buyerId,
        type: 'dispute_opened',
        title: 'Disputa abierta',
        body: 'Tu disputa fue creada. Soporte revisará el caso en este chat.',
        data: { disputeId, orderId },
        linkTo: `/dashboard/compras?order=${orderId}`,
        channels: ['panel'],
        priority: 'medium',
      });
    } catch {
      // Fallback a método anterior
      try {
        const { insertNotificationBestEffort } = await import('@/lib/notifications/insertBestEffort');
        await insertNotificationBestEffort(admin, {
          user_id: buyerId,
          type: 'dispute_opened',
          title: 'Disputa abierta',
          body: 'Tu disputa fue creada. Soporte revisará el caso en este chat.',
          data: { disputeId, orderId },
          link_to: `/dashboard/compras?order=${orderId}`,
          is_read: false,
        });
      } catch {
        // noop
      }
    }

    void notifyDisputeOpened({ buyerId, sellerId, orderId }).catch((e) =>
      console.warn('[disputes/open] email notifyDisputeOpened:', e)
    );

    const resp = NextResponse.json({ ok: true, disputeId, orderId });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error opening dispute' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

