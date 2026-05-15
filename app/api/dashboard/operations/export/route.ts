import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toNumber, statusLabel } from '@/lib/payouts/calc';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function escapeCsv(s: string): string {
  const t = String(s ?? '').trim().replace(/"/g, '""');
  return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Falta Authorization Bearer' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const userId = userData.user.id;
    const admin = supabaseAdmin();

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const since = oneYearAgo.toISOString();

    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('id,buyer_id,seller_id,status,total,shipping_fee,commission_fee,created_at,paid_to_seller_at')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 400 });

    const list = ((orders as any[]) ?? []) as any[];
    const orderIds = list.map((o) => String(o?.id ?? '').trim()).filter(Boolean);

    let itemsByOrder: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      const { data: items } = await admin
        .from('order_items')
        .select('order_id,title,quantity,line_total')
        .in('order_id', orderIds);
      if (Array.isArray(items)) {
        for (const it of items as any[]) {
          const oid = String(it?.order_id ?? '').trim();
          if (!oid) continue;
          if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
          itemsByOrder[oid].push(it);
        }
      }
    }

    const ids = Array.from(
      new Set(list.flatMap((o) => [String(o?.buyer_id ?? ''), String(o?.seller_id ?? '')]).filter((x) => x && x !== userId)),
    );
    const names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await admin.from('profiles').select('id,full_name,nickname,username').in('id', ids);
      if (Array.isArray(profiles)) {
        for (const p of profiles as any[]) {
          const id = String(p?.id ?? '').trim();
          if (!id) continue;
          names[id] =
            String(p?.full_name ?? '').trim() ||
            String(p?.nickname ?? '').trim() ||
            String(p?.username ?? '').trim() ||
            `${id.slice(0, 8)}…`;
        }
      }
    }

    const headers = ['Tipo', 'Fecha', 'ID', 'Contraparte', 'Artículos', 'Total (MXN)', 'Envío', 'Comisión', 'Estado', 'Liberado'];
    const rows: string[] = [headers.map(escapeCsv).join(',')];

    for (const o of list) {
      const isSale = String(o?.seller_id) === userId;
      const otherId = isSale ? String(o?.buyer_id ?? '') : String(o?.seller_id ?? '');
      const otherName = otherId ? names[otherId] || `${otherId.slice(0, 8)}…` : '—';
      const items = itemsByOrder[o.id] ?? [];
      const articles = items.map((it: any) => `${String(it?.title ?? '')} x${Number(it?.quantity ?? 1) || 1}`).join('; ');
      const created = o?.created_at ? formatDate(new Date(o.created_at)) : '—';
      const status = statusLabel(String(o?.status ?? ''));
      const liberado = isSale ? (o?.paid_to_seller_at ? 'Sí' : 'No') : '—';

      rows.push(
        [
          isSale ? 'Venta' : 'Compra',
          created,
          String(o?.id ?? '').slice(0, 8),
          otherName,
          articles,
          toNumber(o?.total).toFixed(2),
          toNumber(o?.shipping_fee).toFixed(2),
          toNumber(o?.commission_fee).toFixed(2),
          status,
          liberado,
        ]
          .map(escapeCsv)
          .join(','),
      );
    }

    const csv = '\uFEFF' + rows.join('\r\n');
    const res = new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="operaciones-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    return res;
  } catch (e: unknown) {
    console.error('[dashboard/operations/export]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al exportar' },
      { status: 500 },
    );
  }
}
