import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as { orderIds?: string[]; sellerId?: string; action?: 'mark_paid' | 'mark_unpaid'; adminName?: string | null };
    const rawOrderIds = Array.isArray(body?.orderIds) ? body.orderIds : [];
    const orderIds = rawOrderIds.map(String).map((x) => x.trim()).filter(Boolean);
    const sellerId = String(body?.sellerId || '').trim();
    const action = String(body?.action || 'mark_paid').trim() as 'mark_paid' | 'mark_unpaid';
    const adminName = String(body?.adminName || '').trim() || null;

    if (!['mark_paid', 'mark_unpaid'].includes(action)) return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    if (action === 'mark_paid' && !adminName) return NextResponse.json({ error: 'adminName es requerido para marcar como pagado' }, { status: 400 });

    // Si viene sellerId, marcar todas sus órdenes liberadas (delivered) que aún no estén pagadas
    // NOTA: El enum order_status NO incluye 'completed', solo 'delivered'
    let targetOrderIds: string[] = [];
    if (sellerId) {
      // Validación crítica: verificar que el sellerId sea válido
      if (typeof sellerId !== 'string' || sellerId.trim() === '') {
        return NextResponse.json({ error: 'sellerId inválido.' }, { status: 400 });
      }

      // CRÍTICO: Verificar primero si ya hay órdenes pagadas para este sellerId
      // Esto previene procesamiento duplicado si hay múltiples requests simultáneos
      const checkRes: any = await admin
        .from('orders')
        .select('id, paid_to_seller_at')
        .eq('seller_id', sellerId)
        .in('status', ['delivered'])
        .limit(5000);
      
      if (checkRes?.error) {
        return NextResponse.json({ error: checkRes.error.message }, { status: 400 });
      }

      // Filtrar solo las que NO están pagadas (paid_to_seller_at es null)
      const unpaidOrders = ((checkRes.data as any[]) ?? []).filter(
        (o: any) => !o?.paid_to_seller_at
      );
      
      targetOrderIds = unpaidOrders.map((o) => String(o?.id || '').trim()).filter(Boolean);

      // Validación adicional: si no hay órdenes para actualizar, retornar mensaje claro
      if (targetOrderIds.length === 0) {
        const totalDelivered = ((checkRes.data as any[]) ?? []).length;
        if (totalDelivered > 0) {
          return NextResponse.json({ 
            ok: true, 
            updated: 0, 
            message: `Todas las órdenes liberadas de este vendedor ya están marcadas como pagadas.` 
          });
        }
        return NextResponse.json({ 
          ok: true, 
          updated: 0, 
          message: 'No hay órdenes liberadas para este vendedor.' 
        });
      }
    } else if (orderIds.length > 0) {
      // Validar que los orderIds sean válidos
      const validOrderIds = orderIds.filter((id) => typeof id === 'string' && id.trim() !== '');
      if (validOrderIds.length === 0) {
        return NextResponse.json({ error: 'orderIds inválidos.' }, { status: 400 });
      }
      targetOrderIds = validOrderIds.slice(0, 500); // guardrail
    } else {
      return NextResponse.json({ error: 'orderIds o sellerId requerido.' }, { status: 400 });
    }

    // CRÍTICO: Verificar una vez más que las órdenes no estén ya pagadas
    // Esto previene condiciones de carrera si hay múltiples requests simultáneos
    if (action === 'mark_paid' && targetOrderIds.length > 0) {
      const doubleCheckRes: any = await admin
        .from('orders')
        .select('id, paid_to_seller_at')
        .in('id', targetOrderIds)
        .is('paid_to_seller_at', null);
      
      if (doubleCheckRes?.error) {
        return NextResponse.json({ error: doubleCheckRes.error.message }, { status: 400 });
      }

      const stillUnpaidIds = ((doubleCheckRes.data as any[]) ?? [])
        .map((o) => String(o?.id || '').trim())
        .filter(Boolean);

      // Si algunas órdenes ya fueron pagadas por otro request, usar solo las que aún están pendientes
      if (stillUnpaidIds.length < targetOrderIds.length) {
        console.warn(
          `[MARK PAID] Algunas órdenes ya fueron pagadas. Procesando solo ${stillUnpaidIds.length} de ${targetOrderIds.length}.`
        );
        targetOrderIds = stillUnpaidIds;
      }

      if (targetOrderIds.length === 0) {
        return NextResponse.json({ 
          ok: true, 
          updated: 0, 
          message: 'Todas las órdenes ya fueron marcadas como pagadas por otro proceso.' 
        });
      }
    }

    const now = new Date().toISOString();
    const payload: any =
      action === 'mark_paid'
        ? { paid_to_seller_at: now, paid_to_seller_by: requesterId }
        : { paid_to_seller_at: null, paid_to_seller_by: null };

    // Intentar actualizar con paid_to_seller_by_name si existe la columna
    // CRÍTICO: Solo actualizar órdenes que aún no estén pagadas (.is('paid_to_seller_at', null)).
    // mark_unpaid borra paid_to_seller_at: uso excepcional; no ejecutar en actualizaciones masivas.
    let upd: any = await admin
      .from('orders')
      .update(payload)
      .in('id', targetOrderIds)
      .is('paid_to_seller_at', null); // Condición adicional para prevenir doble pago
    if (upd?.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        // Si falla por columna faltante, intentar sin paid_to_seller_by_name
        const fallbackPayload: any = action === 'mark_paid' ? { paid_to_seller_at: now, paid_to_seller_by: requesterId } : { paid_to_seller_at: null, paid_to_seller_by: null };
        upd = await admin.from('orders').update(fallbackPayload).in('id', targetOrderIds);
        if (upd?.error) {
          return NextResponse.json(
            { error: 'Tu tabla `orders` no tiene `paid_to_seller_at`. Ejecuta `supabase_orders_paid_to_seller.sql` y recarga.' },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json({ error: upd.error.message }, { status: 400 });
      }
    }

    // Si la acción es mark_paid y tenemos adminName, intentar guardarlo en un campo adicional si existe
    // Nota: Si no existe paid_to_seller_by_name, se puede agregar después con SQL
    if (action === 'mark_paid' && adminName) {
      try {
        // Intentar actualizar con el nombre del admin (best-effort, puede no existir la columna)
        await admin
          .from('orders')
          .update({ paid_to_seller_by_name: adminName } as any)
          .in('id', targetOrderIds);
      } catch {
        // Ignorar si la columna no existe, no es crítico
      }
    }

    const resp = NextResponse.json({ ok: true, updated: targetOrderIds.length, orderIds: targetOrderIds });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
