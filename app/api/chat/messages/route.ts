import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
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
  // Detecta teléfonos por conteo de dígitos (10+ suele ser MX) y por secuencias largas.
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 10) return true;
  if (/\b\d{7,}\b/.test(text)) return true;
  return false;
}

async function isAdminUser(admin: any, userId: string) {
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

async function getOrderParticipants(admin: any, orderId: string) {
  const { data: row, error } = await admin.from('orders').select('id,buyer_id,seller_id').eq('id', orderId).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 404, error: 'Orden no encontrada.' };
  const buyerId = String((row as any)?.buyer_id || '').trim();
  const sellerId = String((row as any)?.seller_id || '').trim();
  return { ok: true as const, buyerId, sellerId };
}

function insertNotificationBestEffortFactory() {
  return async (admin: any, payload: any) => {
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
  };
}

export async function GET(req: NextRequest) {
  try {
    const { userId, effectiveUserId, impersonating } = await requireAuth(req);

    const orderId = String(req.nextUrl.searchParams.get('orderId') || '').trim();
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 80)));
    if (!orderId || !isUuid(orderId)) return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });

    const admin = supabaseAdmin();
    const order = await getOrderParticipants(admin, orderId);
    if (!order.ok) return NextResponse.json({ error: order.error }, { status: order.status });
    const adminOk = await isAdminUser(admin, userId).catch(() => false);
    if (!adminOk && order.buyerId !== effectiveUserId && order.sellerId !== effectiveUserId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    // Preferimos columnas nuevas; si no existen, hacemos fallback.
    let res: any = await admin
      .from('order_messages')
      .select('id,order_id,sender_id,sender_role,body,attachments,created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (res?.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        res = await admin
          .from('order_messages')
          .select('id,order_id,sender_id,body,created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .limit(limit);
      }
    }

    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json(
          { error: 'Falta la tabla de chat. Ejecuta `supabase_order_chat.sql` en Supabase.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: String((res.error as any)?.message || res.error) }, { status: 400 });
    }

    const raw = ((res.data as any[]) ?? []).map((m) => ({
      ...m,
      sender_role: (m as any)?.sender_role ?? null,
      attachments: (m as any)?.attachments ?? [],
    }));

    const resp = NextResponse.json({
      ok: true,
      order: { id: orderId, buyer_id: order.buyerId, seller_id: order.sellerId },
      messages: raw,
      viewer: { user_id: effectiveUserId, is_admin: !impersonating && adminOk },
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

export async function POST(req: NextRequest) {
  try {
    const { userId, effectiveUserId, impersonating } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as { orderId?: string; message?: string; attachments?: any[] };
    const orderId = String(body?.orderId || '').trim();
    const message = String(body?.message || '').trim();
    if (!orderId || !isUuid(orderId)) return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
    if (message.length > 800) return NextResponse.json({ error: 'Mensaje demasiado largo (máx. 800).' }, { status: 400 });

    // Bloqueo anti-contacto
    if (message && (looksLikeLink(message) || looksLikePhone(message))) {
      return NextResponse.json(
        { error: 'Por seguridad no se permiten enlaces ni números de teléfono en el chat.' },
        { status: 400 },
      );
    }

    const admin = supabaseAdmin();
    const order = await getOrderParticipants(admin, orderId);
    if (!order.ok) return NextResponse.json({ error: order.error }, { status: order.status });
    const adminOk = await isAdminUser(admin, userId).catch(() => false);
    if (!adminOk && order.buyerId !== effectiveUserId && order.sellerId !== effectiveUserId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const atts = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!message && atts.length === 0) return NextResponse.json({ error: 'Escribe un mensaje o adjunta un archivo.' }, { status: 400 });
    if (atts.length > 4) return NextResponse.json({ error: 'Máximo 4 adjuntos por mensaje.' }, { status: 400 });

    const senderRole =
      adminOk && !impersonating
        ? 'admin'
        : effectiveUserId === order.buyerId
          ? 'buyer'
          : effectiveUserId === order.sellerId
            ? 'seller'
            : 'user';

    const insertNotification = insertNotificationBestEffortFactory();

    // Insert con columnas nuevas; si no existen, hacemos fallback (texto) o pedimos migración (adjuntos/admin).
    let ins: any = await admin
      .from('order_messages')
      .insert([{ order_id: orderId, sender_id: effectiveUserId, sender_role: senderRole, body: message || '', attachments: atts }])
      .select('id,order_id,sender_id,sender_role,body,attachments,created_at')
      .single();

    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        // Si hay adjuntos o es admin, no podemos degradar sin perder la info.
        if (atts.length > 0 || senderRole === 'admin') {
          return NextResponse.json(
            { error: 'Faltan columnas para adjuntos/roles. Ejecuta `supabase_order_chat_upgrade.sql` en Supabase.' },
            { status: 400 },
          );
        }
        // Fallback: tabla vieja (sin sender_role/attachments)
        ins = await admin
          .from('order_messages')
          .insert([{ order_id: orderId, sender_id: effectiveUserId, body: message || '' }])
          .select('id,order_id,sender_id,body,created_at')
          .single();
      }
    }

    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json(
          { error: 'Falta la tabla de chat. Ejecuta `supabase_order_chat.sql` en Supabase.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: String((ins.error as any)?.message || ins.error) }, { status: 400 });
    }

    // Notificar a las otras partes
    const snippet =
      message?.trim()
        ? message.trim().slice(0, 120)
        : atts.length > 0
          ? `Adjunto(s): ${atts.length}`
          : 'Nuevo mensaje';

    const recipients = [order.buyerId, order.sellerId].filter((id) => id && id !== effectiveUserId);
    const notifyErrors: any[] = [];
    for (const uid of recipients) {
      const title = uid === order.buyerId ? 'Nuevo mensaje en tu compra' : 'Nuevo mensaje en tu venta';
      const payload: any = {
        user_id: uid,
        type: 'order_chat_message',
        title,
        body: snippet,
        data: { orderId, from: senderRole },
        is_read: false,
      };
      const r = await insertNotification(admin, payload);
      if (!r.ok) notifyErrors.push({ user_id: uid, ...r });
    }

    // Si el que envía es admin, avisamos a buyer y seller (ya lo hace recipients). Si buyer/seller envía, solo al otro.

    const resp = NextResponse.json({ ok: true, message: ins.data, notified: recipients.length, notifyErrors });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

