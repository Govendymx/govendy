import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.effectiveUserId;
    const admin = auth.admin;

    const body = (await req.json().catch(() => ({}))) as { orderIds?: unknown };
    const orderIdsRaw = Array.isArray(body?.orderIds) ? body.orderIds : [];
    const orderIds = Array.from(
      new Set(
        orderIdsRaw
          .map((v) => String(v || '').trim())
          .filter((v) => v && isUuid(v)),
      ),
    );

    if (orderIds.length === 0) {
      return NextResponse.json({ ok: true, hasUnreadByOrderId: {} });
    }

    const { data: orders, error: oErr } = await admin
      .from('orders')
      .select('id,buyer_id,seller_id')
      .in('id', orderIds)
      .limit(2000);

    if (oErr) {
      return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
    }

    const allowedIds = new Set(
      (orders ?? [])
        .filter((o: any) => {
          const id = String(o?.id || '').trim();
          if (!id) return false;
          const b = String(o?.buyer_id || '').trim();
          const s = String(o?.seller_id || '').trim();
          return b === userId || s === userId;
        })
        .map((o: any) => String(o.id).trim()),
    );

    if (allowedIds.size === 0) {
      return NextResponse.json({ ok: true, hasUnreadByOrderId: {} });
    }

    const allowed = Array.from(allowedIds);

    let messagesRes: any = await admin
      .from('order_messages')
      .select('order_id,sender_id,created_at')
      .in('order_id', allowed)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (messagesRes?.error) {
      const code = String((messagesRes.error as any)?.code || '');
      const msg = String((messagesRes.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ ok: true, hasUnreadByOrderId: {} });
      }
      return NextResponse.json({ ok: false, error: messagesRes.error.message }, { status: 500 });
    }

    const lastBy: Record<string, { sender_id: string; created_at: string }> = {};
    if (Array.isArray(messagesRes.data)) {
      for (const r of messagesRes.data as any[]) {
        const oid = String(r?.order_id || '').trim();
        if (!oid || !allowedIds.has(oid) || lastBy[oid]) continue;
        lastBy[oid] = {
          sender_id: String(r?.sender_id || '').trim(),
          created_at: String(r?.created_at || '').trim(),
        };
      }
    }

    const readsRes: any = await admin
      .from('order_chat_reads')
      .select('order_id,last_read_at')
      .eq('user_id', userId)
      .in('order_id', allowed);

    const reads: Record<string, string> = {};
    if (!readsRes?.error && Array.isArray(readsRes.data)) {
      for (const r of readsRes.data as any[]) {
        const oid = String(r?.order_id || '').trim();
        if (!oid) continue;
        reads[oid] = String(r?.last_read_at || '').trim();
      }
    }

    const hasUnreadByOrderId: Record<string, boolean> = {};
    for (const oid of allowed) {
      const last = lastBy[oid];
      if (!last?.created_at) {
        hasUnreadByOrderId[oid] = false;
        continue;
      }
      if (last.sender_id && last.sender_id === userId) {
        hasUnreadByOrderId[oid] = false;
        continue;
      }
      const lastAt = Date.parse(last.created_at);
      const readAt = reads[oid] ? Date.parse(reads[oid]) : NaN;
      hasUnreadByOrderId[oid] = Number.isFinite(lastAt) && (!Number.isFinite(readAt) || lastAt > readAt);
    }

    return NextResponse.json({ ok: true, hasUnreadByOrderId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

