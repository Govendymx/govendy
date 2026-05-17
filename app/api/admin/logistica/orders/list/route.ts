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

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const status = String(req.nextUrl.searchParams.get('status') || '').trim(); // paid | shipped | delivered ...
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200)));

    const debug: any = {
      statusParam: status || null,
      limit,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        SUPABASE_URL: process.env.SUPABASE_URL || null,
      },
    };

    // Conteo (para diagnosticar casos de "0 operaciones")
    try {
      const countRes: any = await admin.from('orders').select('id', { count: 'exact', head: true });
      debug.ordersCount = typeof countRes?.count === 'number' ? countRes.count : null;
      if (countRes?.error) debug.ordersCountError = String((countRes.error as any)?.message || countRes.error);
    } catch (e: unknown) {
      debug.ordersCount = null;
      debug.ordersCountError = e instanceof Error ? e.message : 'count_failed';
    }

    const fullSelect =
      'id,buyer_id,seller_id,status,payment_method,subtotal,shipping_fee,commission_fee,total,created_at,paid_at,paid_to_seller_at,shipping_full_name,shipping_phone,shipping_address,shipping_label_url,shipping_label_uploaded_at,shipping_label_uploaded_by,label_downloaded_at,tracking_number,shipped_at,delivered_at,shipping_carrier,shipping_option_id,shipping_subsidy,delivery_proof_url,buyer_payment_voucher_url,shipping_by_seller';
    const baseSelect =
      'id,buyer_id,seller_id,status,payment_method,subtotal,shipping_fee,commission_fee,total,created_at,paid_at,paid_to_seller_at,shipping_full_name,shipping_phone,shipping_address,shipping_label_url,tracking_number,shipped_at,delivered_at,shipping_carrier,shipping_option_id,shipping_subsidy,buyer_payment_voucher_url,shipping_by_seller';

    console.log('[logistica/orders/list] Iniciando consulta...', { status, limit });

    // CRÍTICO: Mostrar TODAS las órdenes relevantes para logística
    // Sin restricciones de tiempo ni filtros ocultos - esto asegura que las operaciones siempre aparezcan
    let q: any = admin
      .from('orders')
      .select(fullSelect)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Si no se especifica status, por defecto mostramos las que requieren acción logística
    // Esto es: pending_payment, paid, shipping_label_generated, shipped
    // Excluimos: cancelled, refunded, delivered, completed, disputed
    if (status) {
      console.log('[logistica/orders/list] Aplicando filtro de status:', status);
      // Validar que el status sea válido antes de consultar
      const validStatuses = ['pending_payment', 'awaiting_voucher', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed'];
      if (validStatuses.includes(status)) {
        q = q.eq('status', status);
      } else {
        console.warn('[logistica/orders/list] Status inválido recibido:', status);
        // Si es inválido, no filtrar por status (o devolver array vacío, pero mejor ignorar el filtro)
      }
    } else {
      console.log('[logistica/orders/list] Sin filtro específico - mostrando órdenes relevantes para logística');
      // Mostrar órdenes que requieren atención logística o tienen evidencia pendiente de revisión
      // Incluimos 'delivered' para que los admins vean las órdenes con constancia de entrega subida
      q = q.in('status', ['pending_payment', 'awaiting_voucher', 'paid', 'shipped', 'delivered']);
    }

    let res: any = await q;
    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        // Fallback: devolver órdenes aunque falten columnas de logística
        debug.missingLogisticsColumns = true;
        let q2: any = admin.from('orders').select(baseSelect).order('created_at', { ascending: false }).limit(limit);
        if (status) {
          console.log('[logistica/orders/list] Fallback: Aplicando filtro de status:', status);
          const validStatuses = ['pending_payment', 'awaiting_voucher', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed'];
          if (validStatuses.includes(status)) {
            q2 = q2.eq('status', status);
          } else {
            console.warn('[logistica/orders/list] Fallback: Status inválido recibido:', status);
          }
        } else {
          console.log('[logistica/orders/list] Fallback: Sin filtro de status - mostrando todas las órdenes');
        }
        res = await q2;
        if (res.error) {
          const resp = NextResponse.json(
            { error: 'Faltan columnas de logística en `orders`. Ejecuta `supabase_orders_logistics.sql` en Supabase.', debug },
            { status: 400 },
          );
          resp.headers.set('Cache-Control', 'no-store, max-age=0');
          return resp;
        }
      } else {
        const resp = NextResponse.json({ error: res.error.message, debug }, { status: 400 });
        resp.headers.set('Cache-Control', 'no-store, max-age=0');
        return resp;
      }
    }

    const orders = (res.data as any[]) ?? [];
    const orderIds = orders.map((o) => String(o?.id || '')).filter(Boolean);

    // Logging para diagnóstico
    const statusCounts: Record<string, number> = {};
    for (const o of orders) {
      const st = String(o?.status || 'unknown').trim();
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    }
    // CRÍTICO: Verificar que shipping_label_url está incluido en la respuesta
    const sampleOrderWithLabel = orders.find((o: any) => o?.shipping_label_url);
    console.log('[logistica/orders/list] Órdenes obtenidas:', {
      total: orders.length,
      statusCounts,
      statusFilter: status || 'ninguno',
      limit,
      totalInDb: debug.ordersCount,
      sampleIds: orders.slice(0, 5).map((o: any) => ({ id: o?.id, status: o?.status, created_at: o?.created_at })),
      hasShippingLabelUrlField: orders.length > 0 ? 'shipping_label_url' in orders[0] : false,
      ordersWithLabel: orders.filter((o: any) => o?.shipping_label_url).length,
      sampleOrderWithLabel: sampleOrderWithLabel ? {
        id: sampleOrderWithLabel.id,
        hasShippingLabelUrl: !!sampleOrderWithLabel.shipping_label_url,
        shipping_label_url: sampleOrderWithLabel.shipping_label_url?.substring(0, 50) + '...',
      } : null,
    });
    debug.statusCounts = statusCounts;

    // Disputas por orden (best-effort)
    const disputeByOrderId: Record<string, { id: string; status: string }> = {};
    if (orderIds.length > 0) {
      try {
        const dRes: any = await admin.from('disputes').select('id,order_id,status').in('order_id', orderIds).limit(5000);
        if (dRes?.error) {
          const code = String((dRes.error as any)?.code || '');
          const msg = String((dRes.error as any)?.message || '').toLowerCase();
          if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
            debug.disputesTableMissing = true;
          } else {
            debug.disputesError = String((dRes.error as any)?.message || '');
          }
        } else if (Array.isArray(dRes.data)) {
          for (const d of dRes.data as any[]) {
            const oid = String(d?.order_id || '').trim();
            const id = String(d?.id || '').trim();
            const st = String(d?.status || '').trim();
            if (oid && id) disputeByOrderId[oid] = { id, status: st || 'open' };
          }
        }
      } catch (e: unknown) {
        debug.disputesError = e instanceof Error ? e.message : 'disputes_failed';
      }
    }

    // Items, Thumbnails, Weights & Shipping Config
    const itemsByOrder: Record<string, any[]> = {};
    const weightByOrderId: Record<string, number> = {};
    const dimsByOrderId: Record<string, { length_cm: number; width_cm: number; height_cm: number }> = {};
    const productTypeByOrderId: Record<string, string> = {};

    if (orderIds.length > 0) {
      const itemsRes: any = await admin.from('order_items').select('order_id,title,quantity,line_total,listing_id').in('order_id', orderIds).limit(5000);

      const listingIds = new Set<string>();

      if (!itemsRes.error && Array.isArray(itemsRes.data)) {
        for (const it of itemsRes.data as any[]) {
          const oid = String(it?.order_id || '');
          if (!oid) continue;
          if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
          itemsByOrder[oid].push(it);
          if (it.listing_id) listingIds.add(it.listing_id);
        }
      }

      // Resolver thumbnails, dimensiones, weights y shipping_by_seller por listing
      const listingThumbById: Record<string, string> = {};
      const weightByListingId: Record<string, number> = {};
      const dimsByListingId: Record<string, { length_cm: number; width_cm: number; height_cm: number }> = {};
      const shippingBySellerByListingId: Record<string, boolean> = {};
      const productTypeByListingId: Record<string, string> = {};
      if (listingIds.size > 0) {
        const listingsRes: any = await admin
          .from('listings')
          .select('id,weight_kg,length_cm,width_cm,height_cm,images,public_id,shipping_by_seller,product_type,free_shipping,sale_type')
          .in('id', Array.from(listingIds));
        if (!listingsRes.error && Array.isArray(listingsRes.data)) {
          for (const l of listingsRes.data) {
            const lid = String(l?.id || '').trim();
            weightByListingId[lid] = Number(l?.weight_kg || 0);
            dimsByListingId[lid] = {
              length_cm: Number(l?.length_cm || 0),
              width_cm: Number(l?.width_cm || 0),
              height_cm: Number(l?.height_cm || 0),
            };
            shippingBySellerByListingId[lid] = Boolean((l as any)?.shipping_by_seller ?? false);
            productTypeByListingId[lid] = String((l as any)?.product_type || 'physical');
            // Track free_shipping and sale_type per listing for correct shipping type display
            (shippingBySellerByListingId as any)[`freeShip_${lid}`] = Boolean((l as any)?.free_shipping);
            (shippingBySellerByListingId as any)[`saleType_${lid}`] = String((l as any)?.sale_type || 'direct');
            let imgs: string[] = [];
            const raw = (l as any)?.images;
            if (Array.isArray(raw)) {
              imgs = raw.map((x: any) => String(x || '').trim()).filter(Boolean);
            } else if (typeof raw === 'string') {
              const s = raw.trim();
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) imgs = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
              } catch {
                if (s.startsWith('http') || s.startsWith('/')) imgs = [s];
              }
            }
            const publicId = String((l as any)?.public_id || '').trim();
            const first = imgs[0] || '';
            if (first) {
              listingThumbById[lid] = first;
              if (publicId) listingThumbById[publicId] = first;
            }
          }
        }
      }

      // Adjuntar thumbnail, dimensiones y shipping_by_seller en itemsByOrder
      for (const oid of Object.keys(itemsByOrder)) {
        itemsByOrder[oid] = (itemsByOrder[oid] || []).map((it: any) => {
          const thumb = listingThumbById[String(it?.listing_id || '').trim()] || null;
          const dims = dimsByListingId[String(it?.listing_id || '').trim()] || { length_cm: 0, width_cm: 0, height_cm: 0 };
          const sbs = shippingBySellerByListingId[String(it?.listing_id || '').trim()];
          const pt = productTypeByListingId[String(it?.listing_id || '').trim()] || 'physical';
          const freeShipFlag = (shippingBySellerByListingId as any)[`freeShip_${String(it?.listing_id || '').trim()}`];
          const saleTypeFlag = (shippingBySellerByListingId as any)[`saleType_${String(it?.listing_id || '').trim()}`];
          const isGoVendyFree = Boolean(freeShipFlag) && !Boolean(sbs);
          return { ...it, image: thumb, length_cm: dims.length_cm, width_cm: dims.width_cm, height_cm: dims.height_cm, shipping_by_seller: typeof sbs === 'boolean' ? sbs : null, product_type: pt, is_gopocket_free: isGoVendyFree, sale_type: saleTypeFlag || 'direct' };
        });
      }

      // Build productTypeByOrderId map
      for (const oid of orderIds) {
        const items = itemsByOrder[oid] || [];
        const hasDigitalItem = items.some((it: any) => it.product_type === 'digital');
        productTypeByOrderId[oid] = hasDigitalItem ? 'digital' : 'physical';
      }

      // Calcular peso total por orden y dimensiones apiladas (L×W toman máx, H se apila × qty)
      for (const oid of orderIds) {
        const items = itemsByOrder[oid] || [];
        let totalRealW = 0;
        let maxL = 0, maxW = 0, stackedH = 0;
        for (const it of items) {
          const w = weightByListingId[it.listing_id] || 0;
          const qty = it.quantity || 1;
          totalRealW += w * qty;
          maxL = Math.max(maxL, Number(it?.length_cm || 0));
          maxW = Math.max(maxW, Number(it?.width_cm || 0));
          stackedH += (Number(it?.height_cm || 0)) * qty;
        }
        // Peso volumétrico con dimensiones apiladas: L × W × H(apilado) / 5000
        const volW = (maxL * maxW * stackedH) / 5000;
        weightByOrderId[oid] = Math.max(totalRealW, volW);
        dimsByOrderId[oid] = { length_cm: maxL, width_cm: maxW, height_cm: stackedH };
      }
    }

    // Buyer/Seller profiles (best-effort)
    const userIds = Array.from(new Set(orders.flatMap((o) => [String(o?.buyer_id || ''), String(o?.seller_id || '')]).filter(Boolean)));
    const nameById: Record<string, string> = {};
    const addressById: Record<string, any> = {};
    if (userIds.length > 0) {
      let profRes: any = await admin
        .from('profiles')
        .select('id,full_name,username,phone,address_street,ext_number,int_number,neighborhood,zip_code,state,city,references,cross_streets')
        .in('id', userIds);
      if (profRes.error) {
        const code = String((profRes.error as any)?.code || '');
        const msg = String((profRes.error as any)?.message || '').toLowerCase();
        if (code === '42703' || msg.includes('column')) {
          profRes = await admin.from('profiles').select('id,full_name,username,address_street,ext_number,int_number,neighborhood,zip_code,state,city').in('id', userIds);
          if (profRes.error) {
            profRes = await admin.from('profiles').select('id,full_name,username').in('id', userIds);
          }
        }
      }
      if (!profRes.error && Array.isArray(profRes.data)) {
        for (const p of profRes.data as any[]) {
          const id = String(p?.id || '').trim();
          if (!id) continue;
          const name = String(p?.full_name || '').trim() || String(p?.username || '').trim() || `${id.slice(0, 6)}…`;
          nameById[id] = name;
          addressById[id] = {
            address_street: p?.address_street ?? null,
            ext_number: p?.ext_number ?? null,
            int_number: p?.int_number ?? null,
            neighborhood: p?.neighborhood ?? null,
            zip_code: p?.zip_code ?? null,
            state: p?.state ?? null,
            city: p?.city ?? null,
            phone: (p as any)?.phone ?? null,
            references: (p as any)?.references ?? null,
            cross_streets: (p as any)?.cross_streets ?? null,
          };
        }
      }
    }

    // Fallback: usar shipping_full_name como nombre del comprador si el perfil no lo tiene
    for (const o of orders) {
      const buyerId = String(o?.buyer_id || '').trim();
      if (!buyerId) continue;
      const existing = nameById[buyerId];
      const fallback = String(o?.shipping_full_name || '').trim();
      if (!existing && fallback) {
        nameById[buyerId] = fallback;
      }
    }

    const resp = NextResponse.json({ ok: true, orders, itemsByOrder, nameById, addressById, disputeByOrderId, weightByOrderId, dimsByOrderId, productTypeByOrderId, debug });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

