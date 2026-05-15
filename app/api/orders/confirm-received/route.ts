import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyConfirmReceivedSeller } from '@/lib/email/notify';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function looksLikeLink(text: string) {
  const t = text.toLowerCase();
  if (t.includes('http://') || t.includes('https://')) return true;
  if (t.includes('www.')) return true;
  if (/\b[a-z0-9-]+\.(com|mx|net|org|io|app|me|gg|ly|co|tv|xyz)\b/i.test(t)) return true;
  if (t.includes('wa.me') || t.includes('t.me')) return true;
  return false;
}

function looksLikePhone(text: string) {
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 10) return true;
  if (/\b\d{7,}\b/.test(text)) return true;
  return false;
}

async function insertNotificationBestEffort(admin: any, payload: any) {
  let ins: any = await admin.from('notifications').insert([payload]);
  if (!ins?.error) return { ok: true as const };
  const code = String((ins.error as any)?.code || '');
  const msg = String((ins.error as any)?.message || '').toLowerCase();
  if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist') || code === 'PGRST106') {
    return { ok: false as const, code, message: String((ins.error as any)?.message || '') };
  }
  if (code === '42703' || msg.includes('column')) {
    const f1 = { ...payload };
    delete f1.data;
    delete f1.is_read;
    ins = await admin.from('notifications').insert([f1]);
    if (!ins?.error) return { ok: true as const };
    const code2 = String((ins.error as any)?.code || '');
    const msg2 = String((ins.error as any)?.message || '').toLowerCase();
    if (code2 === '42703' || msg2.includes('column')) {
      const f2: any = { ...f1 };
      if ('body' in f2) {
        f2.message = f2.body;
        delete f2.body;
      }
      ins = await admin.from('notifications').insert([f2]);
      if (!ins?.error) return { ok: true as const };
      return { ok: false as const, code: String((ins.error as any)?.code || ''), message: String((ins.error as any)?.message || '') };
    }
    return { ok: false as const, code: code2, message: String((ins.error as any)?.message || '') };
  }
  return { ok: false as const, code, message: String((ins.error as any)?.message || '') };
}

type Body = {
  orderId: string;
  stars: number;
  comment?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { userId, effectiveUserId, admin } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    const stars = Number(body?.stars ?? 0);
    const comment = String(body?.comment || '').trim();

    if (!orderId || !isUuid(orderId)) return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
    if (!Number.isFinite(stars) || stars < 1 || stars > 10) return NextResponse.json({ error: 'Calificación inválida (1 a 10).' }, { status: 400 });
    if (comment.length > 600) return NextResponse.json({ error: 'Comentario demasiado largo (máx. 600).' }, { status: 400 });
    if (comment && (looksLikeLink(comment) || looksLikePhone(comment))) {
      return NextResponse.json({ error: 'Por seguridad no se permiten enlaces ni teléfonos en el comentario.' }, { status: 400 });
    }

    const actingUserId = effectiveUserId;

    const { data: order, error: oErr } = await admin.from('orders').select('id,buyer_id,seller_id,status,total,shipping_option_id,shipping_carrier,tracking_number').eq('id', orderId).maybeSingle();
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });
    if (!order) return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });

    const buyerId = String((order as any)?.buyer_id || '').trim();
    const sellerId = String((order as any)?.seller_id || '').trim();
    const status = String((order as any)?.status || '').trim();
    
    // Detectar si es entrega personal o tiene guía
    const shippingOptionId = String((order as any)?.shipping_option_id || '').toLowerCase();
    const shippingCarrier = String((order as any)?.shipping_carrier || '').trim().toLowerCase();
    const trackingNumber = String((order as any)?.tracking_number || '').trim();
    
    const isPickup = shippingOptionId === 'pickup' || shippingCarrier === 'pickup';
    const hasTracking = trackingNumber.length > 0;

    if (!buyerId || !sellerId) return NextResponse.json({ error: 'Orden inválida (sin buyer/seller).' }, { status: 400 });
    if (buyerId !== actingUserId) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    if (['cancelled', 'canceled', 'refunded'].includes(status)) return NextResponse.json({ error: 'Esta orden no puede confirmarse.' }, { status: 400 });
    
    // Permitir si es 'paid' y es pickup O tiene guía (bypass de 'shipped')
    if (status !== 'shipped' && status !== 'delivered' && !(status === 'paid' && (isPickup || hasTracking))) {
      return NextResponse.json({ error: 'Aún no puedes confirmar recepción: espera a que el vendedor registre el envío.' }, { status: 400 });
    }

    // 1) Si shipped (o paid+pickup/tracking) → delivered; liberar dinero (paid_to_seller_at) solo si aún no está liberado.
    const now = new Date().toISOString();
    const { data: current } = await admin.from('orders').select('paid_to_seller_at').eq('id', orderId).maybeSingle();
    const alreadyReleased = Boolean((current as any)?.paid_to_seller_at);
    
    const patch: any = (status === 'shipped' || (status === 'paid' && (isPickup || hasTracking))) 
      ? { status: 'delivered', paid_to_seller_at: now, paid_to_seller_by: buyerId } 
      : {};
      
    if (status === 'delivered' && !alreadyReleased) {
      patch.paid_to_seller_at = now;
      patch.paid_to_seller_by = buyerId;
    }
    const upd: any =
      Object.keys(patch).length > 0
        ? await admin.from('orders').update(patch).eq('id', orderId)
        : { error: null };
    if (upd.error) {
      const code = String((upd.error as any)?.code ?? '');
      const msg = String((upd.error as any)?.message ?? '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Falta la columna paid_to_seller_at en orders. Ejecuta supabase_orders_paid_to_seller.sql en Supabase.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: String((upd.error as any)?.message || upd.error) }, { status: 400 });
    }

    try {
      if (status === 'shipped' || (status === 'delivered' && !alreadyReleased)) {
        // Intentar dar cashback si la orden se completó (o se marcó delivered)
        // Usamos void para no bloquear la respuesta, pero logueamos error si falla
        void WalletService.processOrderCashback(orderId).then((amount) => {
           if (amount > 0) console.log(`[Cashback] Granted $${amount} for order ${orderId} (confirmed received)`);
        }).catch(err => console.error('[Cashback] Error in confirm-received:', err));
      }
    } catch (e) {
      // Ignorar errores de cashback para no fallar el confirm
    }

    // 2) Guardar calificación buyer -> seller (best-effort con SQL)
    let ratingCreated = false;
    let ratingId: string | null = null;
    let ratingError: any = null;
    try {
      const ins: any = await admin
        .from('user_ratings')
        .insert([{ order_id: orderId, rater_id: buyerId, ratee_id: sellerId, direction: 'buyer_to_seller', stars: Math.round(stars), comment }])
        .select('id')
        .single();
      if (ins?.error) {
        const code = String((ins.error as any)?.code || '');
        const msg = String((ins.error as any)?.message || '').toLowerCase();
        if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist') || code === 'PGRST106') {
          ratingError = { error: 'Falta la tabla de calificaciones. Ejecuta `supabase_user_ratings.sql` en Supabase.' };
        } else if (code === '23505' || msg.includes('duplicate')) {
          ratingCreated = false;
        } else {
          ratingError = { code, message: String((ins.error as any)?.message || '') };
        }
      } else {
        ratingCreated = true;
        ratingId = String((ins.data as any)?.id || '') || null;
      }
    } catch (e: unknown) {
      ratingError = { message: e instanceof Error ? e.message : 'rating_failed' };
    }

    // Verificar si ambas calificaciones existen
    let bothRated = false;
    let sellerRating: any = null;
    try {
      const sellerRatingRes: any = await admin
        .from('user_ratings')
        .select('id,stars,comment')
        .eq('order_id', orderId)
        .eq('direction', 'seller_to_buyer')
        .maybeSingle();
      if (!sellerRatingRes?.error && sellerRatingRes?.data) {
        sellerRating = sellerRatingRes.data;
        bothRated = true;
      }
    } catch (e) {
      // Ignorar errores al verificar
    }

    // 3) Notificar vendedor (best-effort)
    let notified = false;
    let notify_error: any = null;
    try {
      const payload: any = {
        user_id: sellerId,
        type: 'order_completed',
        title: '✅ Compra completada',
        body: `El comprador confirmó que recibió el artículo. Pago liberado. Calificación recibida: ${Math.round(stars)}/10`,
        data: { 
          kind: 'order_completed',
          orderId, 
          stars: Math.round(stars) 
        },
        is_read: false,
      };
      const insN = await insertNotificationBestEffort(admin, payload);
      notified = insN.ok;
      if (!insN.ok) notify_error = insN;
      void notifyConfirmReceivedSeller({ sellerId, orderId }).catch((e) =>
        console.warn('[confirm-received] email notifyConfirmReceivedSeller:', e)
      );
    } catch (e: unknown) {
      notify_error = { message: e instanceof Error ? e.message : 'notify_failed' };
    }

    // Si ambas calificaciones existen, notificar a ambos que pueden ver sus calificaciones
    let bothNotified = false;
    let bothNotifyError: any = null;
    if (bothRated) {
      try {
        // Notificar al comprador
        const buyerPayload: any = {
          user_id: buyerId,
          type: 'ratings_complete',
          title: 'Ambas calificaciones completadas',
          body: 'Ya puedes ver la calificación que recibiste del vendedor.',
          data: { orderId, kind: 'ratings_complete' },
          is_read: false,
        };
        await insertNotificationBestEffort(admin, buyerPayload);

        // Notificar al vendedor
        const sellerPayload: any = {
          user_id: sellerId,
          type: 'ratings_complete',
          title: 'Ambas calificaciones completadas',
          body: 'Ya puedes ver la calificación que recibiste del comprador.',
          data: { orderId, kind: 'ratings_complete' },
          is_read: false,
        };
        const sellerNotif = await insertNotificationBestEffort(admin, sellerPayload);
        bothNotified = sellerNotif.ok;
        if (!sellerNotif.ok) bothNotifyError = sellerNotif;
      } catch (e: unknown) {
        bothNotifyError = { message: e instanceof Error ? e.message : 'notify_both_failed' };
      }
    }

    const resp = NextResponse.json({
      ok: true,
      order: { id: orderId, status: 'delivered' },
      rating: { created: ratingCreated, id: ratingId, error: ratingError },
      notified,
      notify_error,
      both_rated: bothRated,
      both_notified: bothNotified,
      both_notify_error: bothNotifyError,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

