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
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 10) return true;
  if (/\b\d{7,}\b/.test(text)) return true;
  return false;
}

type Body = {
  orderId: string;
  stars: number;
  comment?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = await requireAuth(req);

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

    const admin = supabaseAdmin();

    const { data: order, error: oErr } = await admin
      .from('orders')
      .select('id,buyer_id,seller_id,status')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });
    if (!order) return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });

    const buyerId = String((order as any)?.buyer_id || '').trim();
    const sellerId = String((order as any)?.seller_id || '').trim();
    const status = String((order as any)?.status || '').trim().toLowerCase();

    if (!buyerId || !sellerId) return NextResponse.json({ error: 'Orden inválida (sin buyer/seller).' }, { status: 400 });
    if (buyerId !== effectiveUserId) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    const allowed = [
      'paid',
      'shipped',
      'delivered',
      'completed',
      'refunded',
      'cancelled',
      'canceled',
    ];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: 'Esta orden aún no se puede calificar.' },
        { status: 400 },
      );
    }

    const existing: any = await admin
      .from('user_ratings')
      .select('id')
      .eq('order_id', orderId)
      .eq('direction', 'buyer_to_seller')
      .eq('rater_id', buyerId)
      .maybeSingle();
    if (!existing?.error && existing?.data) {
      return NextResponse.json({ error: 'Ya calificaste esta compra.' }, { status: 400 });
    }

    let ratingCreated = false;
    let ratingId: string | null = null;
    let ratingError: any = null;
    try {
      const ins: any = await admin
        .from('user_ratings')
        .insert([
          {
            order_id: orderId,
            rater_id: buyerId,
            ratee_id: sellerId,
            direction: 'buyer_to_seller',
            stars: Math.round(stars),
            comment: comment || null,
          },
        ])
        .select('id')
        .single();
      if (ins?.error) {
        const code = String((ins.error as any)?.code || '');
        const msg = String((ins.error as any)?.message || '').toLowerCase();
        if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist') || code === 'PGRST106') {
          ratingError = {
            error: 'Falta la tabla de calificaciones. Ejecuta `supabase_user_ratings.sql` en Supabase.',
          };
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

    let bothRated = false;
    try {
      const sellerRatingRes: any = await admin
        .from('user_ratings')
        .select('id')
        .eq('order_id', orderId)
        .eq('direction', 'seller_to_buyer')
        .maybeSingle();
      if (!sellerRatingRes?.error && sellerRatingRes?.data) {
        bothRated = true;
      }
    } catch {
    }

    const resp = NextResponse.json({
      ok: true,
      order: { id: orderId, status },
      rating: { created: ratingCreated, id: ratingId, error: ratingError },
      both_rated: bothRated,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    const resp = NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 },
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
