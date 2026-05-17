import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing' };

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

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const u = req.nextUrl;
    const status = String(u.searchParams.get('status') || '').trim();
    const hasDispute = u.searchParams.get('has_dispute') === '1';
    const buyerId = String(u.searchParams.get('buyer_id') || '').trim();
    const sellerId = String(u.searchParams.get('seller_id') || '').trim();
    const limit = Math.max(1, Math.min(500, Number(u.searchParams.get('limit') || 200)));
    const search = String(u.searchParams.get('search') || '').trim();

    const base =
      'id,buyer_id,seller_id,status,payment_method,subtotal,shipping_fee,commission_fee,total,created_at,' +
      'shipping_full_name,shipping_phone,shipping_address,shipping_label_url,shipping_label_uploaded_at,label_downloaded_at,' +
      'tracking_number,shipped_at,delivered_at,shipping_carrier,paid_to_seller_at,paid_to_seller_by';

    // IMPORTANTE: No filtrar por status a menos que se especifique explícitamente
    // Esto asegura que todas las órdenes (incluyendo pending_payment) se muestren
    let q: any = admin
      .from('orders')
      .select(base)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Solo aplicar filtro de status si se especifica explícitamente
    // Nota: 'pending' en el filtro puede referirse a 'pending_payment' en la BD
    if (status) {
      if (status === 'pending') {
        q = q.in('status', ['pending_payment', 'awaiting_voucher', 'verifying_payment']);
      } else {
        q = q.eq('status', status);
      }
    }
    if (buyerId) q = q.eq('buyer_id', buyerId);
    if (sellerId) q = q.eq('seller_id', sellerId);
    
    if (search) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)) {
        q = q.or(`id.eq.${search},buyer_id.eq.${search},seller_id.eq.${search}`);
      } else {
        q = q.ilike('shipping_full_name', `%${search}%`);
      }
    }

    let res: any = await q;
    if (res?.error) {
      const code = String((res.error as any)?.code ?? '');
      const msg = String((res.error as any)?.message ?? '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        const fallback = 'id,buyer_id,seller_id,status,payment_method,subtotal,shipping_fee,commission_fee,total,created_at,shipping_full_name,shipping_phone,shipping_address,tracking_number,shipped_at,delivered_at,paid_to_seller_at,paid_to_seller_by';
        let q2: any = admin.from('orders').select(fallback).order('created_at', { ascending: false }).limit(limit);
        if (status) {
          if (status === 'pending') {
            q2 = q2.in('status', ['pending_payment', 'awaiting_voucher', 'verifying_payment']);
          } else {
            q2 = q2.eq('status', status);
          }
        }
        if (buyerId) q2 = q2.eq('buyer_id', buyerId);
        if (sellerId) q2 = q2.eq('seller_id', sellerId);
        if (search) {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)) {
            q2 = q2.or(`id.eq.${search},buyer_id.eq.${search},seller_id.eq.${search}`);
          } else {
            q2 = q2.ilike('shipping_full_name', `%${search}%`);
          }
        }
        res = await q2;
      }
      if (res?.error) {
        const r = NextResponse.json({ error: res.error.message }, { status: 400 });
        r.headers.set('Cache-Control', 'no-store, max-age=0');
        return r;
      }
    }

    const orders = (res?.data as any[]) ?? [];
    const orderIds = orders.map((o) => String(o?.id || '').trim()).filter(Boolean);
    
    console.log('[SUPERVISION/OPERATIONS] Órdenes obtenidas:', {
      total: orders.length,
      limit,
      statusFilter: status || 'ninguno',
      buyerId: buyerId || 'ninguno',
      sellerId: sellerId || 'ninguno',
      sampleIds: orderIds.slice(0, 5),
      statusCounts: orders.reduce((acc: Record<string, number>, o: any) => {
        const st = String(o?.status || 'unknown');
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, {}),
    });

    const disputeByOrderId: Record<string, { id: string; status: string; admin_decision: string | null }> = {};
    if (orderIds.length > 0) {
      try {
        const dRes: any = await admin
          .from('disputes')
          .select('id,order_id,status,admin_decision')
          .in('order_id', orderIds)
          .limit(5000);
        if (!dRes?.error && Array.isArray(dRes.data)) {
          for (const d of dRes.data as any[]) {
            const oid = String(d?.order_id || '').trim();
            const id = String(d?.id || '').trim();
            if (!oid || !id) continue;
            disputeByOrderId[oid] = {
              id,
              status: String(d?.status || '').trim() || 'open',
              admin_decision: d?.admin_decision ? String(d.admin_decision).trim() : null,
            };
          }
        }
      } catch {
        /* ignore */
      }
    }

    const withdrawnOrderIds = new Set<string>();
    try {
      const wRes: any = await admin.from('seller_withdrawals').select('order_ids').eq('status', 'completed').limit(2000);
      if (!wRes?.error && Array.isArray(wRes.data)) {
        for (const w of wRes.data as any[]) {
          const arr = Array.isArray(w?.order_ids) ? w.order_ids : [];
          for (const x of arr) {
            const id = String(x ?? '').trim();
            if (id) withdrawnOrderIds.add(id);
          }
        }
      }
    } catch {
      /* ignore */
    }

    const itemsByOrder: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      const itemsRes: any = await admin.from('order_items').select('order_id,title,quantity,line_total').in('order_id', orderIds).limit(5000);
      if (!itemsRes?.error && Array.isArray(itemsRes.data)) {
        for (const it of itemsRes.data as any[]) {
          const oid = String(it?.order_id || '').trim();
          if (!oid) continue;
          if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
          itemsByOrder[oid].push(it);
        }
      }
    }

    const checkoutSessionByOrder: Record<string, { id: string; status: string; payment_method: string }> = {};
    if (orderIds.length > 0) {
      try {
        const csRes: any = await admin
          .from('checkout_sessions')
          .select('id,order_ids,status,payment_method')
          .overlaps('order_ids', orderIds)
          .limit(1000);
          
        if (!csRes?.error && Array.isArray(csRes.data)) {
          for (const cs of csRes.data as any[]) {
            const sessId = String(cs?.id || '').trim();
            const sessStatus = String(cs?.status || '').trim();
            const sessMethod = String(cs?.payment_method || '').trim();
            const oids = Array.isArray(cs?.order_ids) ? cs.order_ids : [];
            
            for (const oidRaw of oids) {
              const oid = String(oidRaw || '').trim();
              if (orderIds.includes(oid)) {
                checkoutSessionByOrder[oid] = {
                  id: sessId,
                  status: sessStatus,
                  payment_method: sessMethod
                };
              }
            }
          }
        }
      } catch (e) {
        console.error('[SUPERVISION/OPERATIONS] Error fetching checkout sessions:', e);
      }
    }

    const userIds = Array.from(new Set(orders.flatMap((o) => [String(o?.buyer_id || ''), String(o?.seller_id || '')]).filter(Boolean)));
    const nameById: Record<string, string> = {};
    if (userIds.length > 0) {
      let pRes: any = await admin.from('profiles').select('id,full_name,username').in('id', userIds);
      if (pRes?.error) pRes = { data: [] };
      const rows = Array.isArray(pRes?.data) ? pRes.data : [];
      for (const p of rows as any[]) {
        const id = String(p?.id || '').trim();
        if (!id) continue;
        nameById[id] = String(p?.full_name || '').trim() || String(p?.username || '').trim() || `${id.slice(0, 8)}…`;
      }
    }

    let out = orders.map((o) => {
      const oid = String(o?.id || '').trim();
      const d = disputeByOrderId[oid];
      const hasD = Boolean(d);
      const withdrawn = withdrawnOrderIds.has(oid);
      const cs = checkoutSessionByOrder[oid];
      return {
        ...o,
        dispute: d ? { id: d.id, status: d.status, admin_decision: d.admin_decision } : null,
        checkout_session: cs || null,
        has_dispute: hasD,
        withdrawn,
        items: itemsByOrder[oid] ?? [],
        buyer_name: nameById[String(o?.buyer_id || '')] ?? null,
        seller_name: nameById[String(o?.seller_id || '')] ?? null,
      };
    });

    if (hasDispute) out = out.filter((x) => x.has_dispute);

    const resp = NextResponse.json({ ok: true, operations: out, nameById, disputeByOrderId });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[supervision/operations]', e);
    const r = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  }
}
