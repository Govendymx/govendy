import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

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

async function isAdminUser(admin: any, userId: string) {
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

const DISPUTE_SELECT_FULL =
  'id,order_id,buyer_id,seller_id,status,admin_decision,admin_note,return_guide_url,return_tracking,return_guide_charged_to,return_guide_cost';
const DISPUTE_SELECT_BASE = 'id,order_id,buyer_id,seller_id,status,admin_decision,admin_note';

async function getDispute(admin: any, disputeId: string) {
  let { data, error } = await admin
    .from('disputes')
    .select(DISPUTE_SELECT_FULL)
    .eq('id', disputeId)
    .maybeSingle();
  let hasReturnGuide = true;
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('return_guide') || msg.includes('does not exist') || msg.includes('column')) {
      const fallback = await admin
        .from('disputes')
        .select(DISPUTE_SELECT_BASE)
        .eq('id', disputeId)
        .maybeSingle();
      if (fallback.error) return { ok: false as const, status: 400, error: fallback.error.message };
      if (!fallback.data) return { ok: false as const, status: 404, error: 'Disputa no encontrada.' };
      data = fallback.data;
      hasReturnGuide = false;
    } else {
      return { ok: false as const, status: 400, error: error.message };
    }
  }
  if (!data) return { ok: false as const, status: 404, error: 'Disputa no encontrada.' };
  return { ok: true as const, row: data as any, hasReturnGuide };
}

function senderRoleFor(userId: string, dispute: any, isAdmin: boolean) {
  if (isAdmin) return 'admin';
  if (String(dispute?.buyer_id || '') === userId) return 'buyer';
  if (String(dispute?.seller_id || '') === userId) return 'seller';
  return 'user';
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const disputeId = String(req.nextUrl.searchParams.get('disputeId') || '').trim();
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200)));
    if (!disputeId || !isUuid(disputeId)) return NextResponse.json({ error: 'disputeId inválido' }, { status: 400 });

    const admin = supabaseAdmin();
    const isAdmin = await isAdminUser(admin, guard.userId).catch(() => false);
    const d = await getDispute(admin, disputeId);
    if (!d.ok) return NextResponse.json({ error: d.error }, { status: d.status });

    const buyerId = String(d.row.buyer_id || '').trim();
    const sellerId = String(d.row.seller_id || '').trim();
    if (!isAdmin && guard.userId !== buyerId && guard.userId !== sellerId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const orderId = String((d.row as any)?.order_id || '').trim();
    const [msgRes, buyerProf, sellerProf, orderRow, buyerDisputes, sellerDisputes] = await Promise.all([
      admin
        .from('dispute_messages')
        .select('id,dispute_id,sender_id,sender_role,body,attachments,created_at')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true })
        .limit(limit),
      buyerId ? admin.from('profiles').select(isAdmin ? '*' : 'full_name').eq('id', buyerId).maybeSingle() : Promise.resolve({ data: null }),
      sellerId ? admin.from('profiles').select(isAdmin ? '*' : 'full_name').eq('id', sellerId).maybeSingle() : Promise.resolve({ data: null }),
      isAdmin && orderId
        ? admin.from('orders').select('subtotal,shipping_fee,commission_fee,total,listing_id').eq('id', orderId).maybeSingle()
        : Promise.resolve({ data: null }),
      isAdmin && buyerId
        ? admin.from('disputes').select('id', { count: 'exact', head: true }).eq('buyer_id', buyerId)
        : Promise.resolve({ count: 0 }),
      isAdmin && sellerId
        ? admin.from('disputes').select('id', { count: 'exact', head: true }).eq('seller_id', sellerId)
        : Promise.resolve({ count: 0 })
    ]);

    const res = msgRes as any;
    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const buyerName = String((buyerProf as any)?.data?.full_name ?? '').trim() || '';
    const sellerName = String((sellerProf as any)?.data?.full_name ?? '').trim() || '';
    const ord = (orderRow as any)?.data;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? 0) || 0);
    const order_details = ord
      ? {
          subtotal: n(ord.subtotal),
          shipping_fee: n(ord.shipping_fee),
          commission_fee: n(ord.commission_fee),
          total: n(ord.total),
          available_buyer: n(ord.total),
          available_seller: Math.max(0, n(ord.subtotal) + n(ord.shipping_fee) - n(ord.commission_fee)),
          refund_minus_fees: Math.max(0, n(ord.total) - n(ord.commission_fee) - n(ord.shipping_fee)),
        }
      : null;
      
    let listingData = null;
    if (isAdmin && ord?.listing_id) {
      const { data: lData } = await admin.from('listings').select('title, price, cover_url, condition, status').eq('id', ord.listing_id).maybeSingle();
      listingData = lData;
    }

    const return_guide =
      (d as any).hasReturnGuide === false
        ? null
        : (() => {
            const guideUrl = String((d.row as any)?.return_guide_url ?? '').trim();
            const guideTracking = String((d.row as any)?.return_tracking ?? '').trim();
            const guideChargedTo = String((d.row as any)?.return_guide_charged_to ?? '').trim();
            const guideCostRaw = (d.row as any)?.return_guide_cost;
            const guideCost = typeof guideCostRaw === 'number' && Number.isFinite(guideCostRaw)
              ? guideCostRaw
              : Number(guideCostRaw ?? 0);
            return guideUrl || guideTracking
              ? { url: guideUrl || null, tracking: guideTracking || null, charged_to: guideChargedTo || null, cost: Number.isFinite(guideCost) && guideCost >= 0 ? guideCost : null }
              : null;
          })();

    const resp = NextResponse.json({
      ok: true,
      dispute: {
        id: disputeId,
        order_id: (d.row as any)?.order_id,
        buyer_id: buyerId,
        seller_id: sellerId,
        status: d.row.status,
        admin_decision: (d.row as any)?.admin_decision || null,
        admin_note: (d.row as any)?.admin_note || null,
        buyer_name: buyerName,
        seller_name: sellerName,
        buyer_data: isAdmin ? (buyerProf as any)?.data : undefined,
        seller_data: isAdmin ? (sellerProf as any)?.data : undefined,
        buyer_disputes_count: (buyerDisputes as any)?.count || 0,
        seller_disputes_count: (sellerDisputes as any)?.count || 0,
        listing_data: listingData,
        order_details: isAdmin ? order_details : undefined,
        return_guide,
      },
      viewer: { user_id: guard.userId, is_admin: isAdmin, role: senderRoleFor(guard.userId, d.row, isAdmin) },
      messages: (res.data as any[]) ?? [],
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
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = (await req.json().catch(() => ({}))) as { disputeId?: string; message?: string; attachments?: any[] };
    const disputeId = String(body?.disputeId || '').trim();
    const message = String(body?.message || '').trim();
    const atts = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!disputeId || !isUuid(disputeId)) return NextResponse.json({ error: 'disputeId inválido' }, { status: 400 });
    if (message.length > 1200) return NextResponse.json({ error: 'Mensaje demasiado largo (máx. 1200).' }, { status: 400 });
    if (!message && atts.length === 0) return NextResponse.json({ error: 'Escribe un mensaje o adjunta un archivo.' }, { status: 400 });
    if (atts.length > 6) return NextResponse.json({ error: 'Máximo 6 adjuntos por mensaje.' }, { status: 400 });

    // Bloqueo anti-contacto (igual que chat)
    if (message && (looksLikeLink(message) || looksLikePhone(message))) {
      return NextResponse.json({ error: 'Por seguridad no se permiten enlaces ni números de teléfono en disputas.' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const isAdmin = await isAdminUser(admin, guard.userId).catch(() => false);
    const d = await getDispute(admin, disputeId);
    if (!d.ok) return NextResponse.json({ error: d.error }, { status: d.status });

    const buyerId = String(d.row.buyer_id || '').trim();
    const sellerId = String(d.row.seller_id || '').trim();
    const orderId = String(d.row.order_id || '').trim();
    if (!isAdmin && guard.userId !== buyerId && guard.userId !== sellerId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const sender_role = senderRoleFor(guard.userId, d.row, isAdmin);

    const ins: any = await admin
      .from('dispute_messages')
      .insert([
        {
          dispute_id: disputeId,
          sender_id: guard.userId,
          sender_role,
          body: message || '',
          attachments: atts,
        },
      ])
      .select('id,dispute_id,sender_id,sender_role,body,attachments,created_at')
      .single();

    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    // last_message_at (best-effort)
    try {
      await admin.from('disputes').update({ last_message_at: new Date().toISOString() }).eq('id', disputeId);
    } catch {
      // noop
    }

    // Notificar a los otros (buyer/seller + admins)
    const snippet = message ? message.slice(0, 140) : atts.length > 0 ? `Adjunto(s): ${atts.length}` : 'Nuevo mensaje';
    const notifyTargets = new Set<string>();
    if (buyerId) notifyTargets.add(buyerId);
    if (sellerId) notifyTargets.add(sellerId);
    // no notificar al mismo
    notifyTargets.delete(guard.userId);

    for (const uid of Array.from(notifyTargets)) {
      const title = uid === buyerId ? 'Nuevo mensaje en tu disputa' : 'Nuevo mensaje en una disputa';
      await insertNotificationBestEffort(admin, {
        user_id: uid,
        type: 'dispute_message',
        title,
        body: snippet,
        data: { disputeId, orderId, from: sender_role },
        is_read: false,
      });
    }

    // Notificar a administradores
    try {
      const { notifyAdmin } = await import('@/lib/notifications/admin');
      await notifyAdmin.disputeMessage({
        disputeId,
        orderId: orderId || '',
        fromUserId: guard.userId,
      });
    } catch (adminNotifyErr) {
      console.error('[disputes/messages] Error al notificar administradores:', adminNotifyErr);
    }

    const resp = NextResponse.json({ ok: true, message: ins.data });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

