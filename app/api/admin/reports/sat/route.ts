import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import * as XLSX from 'xlsx';

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

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const yearParam = req.nextUrl.searchParams.get('year');
    const monthParam = req.nextUrl.searchParams.get('month');
    const allParam = req.nextUrl.searchParams.get('all');

    let from: string | undefined;
    let to: string | undefined;

    if (allParam === 'true') {
        // No date filter
    } else if (yearParam && monthParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10) - 1;
      if (!isNaN(year) && !isNaN(month)) {
        from = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
        to = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)).toISOString();
      }
    } else {
      // Default to current month if nothing specified? Or maybe just return everything if user wants "toda la info"
      // Let's default to everything if no params, or current month?
      // User asked for "toda la informacion". Default to ALL if no params provided might be risky for performance but fits the request.
      // But usually UI provides filters.
      // Let's implement filters in UI.
    }

    // 1. Fetch Orders (Ingresos / Operaciones)
    let ordersQuery = admin
      .from('orders')
      .select(`
        id, created_at, status, total, subtotal, 
        shipping_fee, shipping_subsidy, commission_fee,
        buyer_id, seller_id
      `)
      .order('created_at', { ascending: false });

    if (from && to) {
      ordersQuery = ordersQuery.gte('created_at', from).lt('created_at', to);
    }
    
    // Filter out cancelled/pending if needed. For SAT, usually only paid/completed matters.
    // 'pending_payment' is definitely not income yet. 'cancelled' is void.
    ordersQuery = ordersQuery.not('status', 'eq', 'pending_payment').not('status', 'eq', 'cancelled');

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) throw ordersError;

    // 2. Fetch Withdrawals (Egresos / Pagos a vendedores)
    let withdrawalsQuery = admin
      .from('seller_withdrawals')
      .select('*')
      .order('created_at', { ascending: false });

    if (from && to) {
      withdrawalsQuery = withdrawalsQuery.gte('created_at', from).lt('created_at', to);
    }
    
    // Only completed withdrawals?
    // withdrawalsQuery = withdrawalsQuery.eq('status', 'approved'); // or 'completed'
    // Let's include all and let them filter in Excel.

    const { data: withdrawals, error: withdrawalsError } = await withdrawalsQuery;
    if (withdrawalsError) throw withdrawalsError;

    // 3. Prepare Excel Data

    // Sheet 1: Ventas (Operaciones)
    const salesData = (orders || []).map((o: any) => ({
      'ID Orden': o.id,
      'Fecha': o.created_at ? new Date(o.created_at).toLocaleString('es-MX') : '',
      'Estatus': o.status,
      'Total Cobrado (MXN)': o.total,
      'Subtotal (Producto)': o.subtotal,
      'Envío Cobrado': o.shipping_fee,
      'Subsidio Envío (Gasto GP)': o.shipping_subsidy,
      'Comisión (Ingreso GP)': o.commission_fee,
      'ID Comprador': o.buyer_id,
      'ID Vendedor': o.seller_id
    }));

    // Sheet 2: Retiros (Pagos a Vendedores)
    const withdrawalsData = (withdrawals || []).map((w: any) => ({
      'ID Retiro': w.id,
      'Fecha Solicitud': w.created_at ? new Date(w.created_at).toLocaleString('es-MX') : '',
      'Vendedor': w.seller_id,
      'Monto (MXN)': w.amount,
      'Estatus': w.status,
      'Fecha Aprobación': w.updated_at ? new Date(w.updated_at).toLocaleString('es-MX') : ''
    }));

    const wb = XLSX.utils.book_new();
    const wsSales = XLSX.utils.json_to_sheet(salesData);
    const wsWithdrawals = XLSX.utils.json_to_sheet(withdrawalsData);

    XLSX.utils.book_append_sheet(wb, wsSales, "Ventas");
    XLSX.utils.book_append_sheet(wb, wsWithdrawals, "Retiros");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="reporte_sat_${new Date().toISOString().slice(0,10)}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Error generando reporte' }, { status: 500 });
  }
}
