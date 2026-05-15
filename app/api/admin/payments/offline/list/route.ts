import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { payoutNet } from '@/lib/payouts/calc';

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

    const status = String(req.nextUrl.searchParams.get('status') || '').trim();
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200)));

    console.log('[ADMIN OFFLINE LIST] Iniciando carga de pagos offline...', { status, limit });

    // Intentar incluir paid_confirmed_at y paid_confirmed_by_name (si existen en tu schema)
    const selectFull =
      'id,buyer_id,order_ids,payment_method,status,amount,reference_code,created_at,payment_proof_url,payment_proof_uploaded_at,paid_confirmed_at,paid_confirmed_by_name';
    const selectBase =
      'id,buyer_id,order_ids,payment_method,status,amount,reference_code,created_at,payment_proof_url,payment_proof_uploaded_at';

    // CRÍTICO: Primero verificar cuántas sesiones hay sin filtro
    const countRes: any = await admin
      .from('checkout_sessions')
      .select('id', { count: 'exact', head: true })
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo', 'mercadopago']);

    console.log('[ADMIN OFFLINE LIST] Total sesiones en BD:', countRes.count);

    let q: any = admin
      .from('checkout_sessions')
      .select(selectFull)
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo', 'mercadopago'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      q = q.eq('status', status);
      console.log('[ADMIN OFFLINE LIST] Filtrando por status:', status);
    }

    // CRÍTICO: Si el filtro es 'pending' (o vacío), TAMBIÉN buscar sesiones 'paid' de MercadoPago recientes que podrían tener inconsistencias
    // Esto asegura que aparezcan en la lista para poder sincronizarlas
    let inconsistencies: any[] = [];
    if (!status || status === 'pending') {
      try {
        const { data: potentialInconsistencies } = await admin
          .from('checkout_sessions')
          .select(selectBase)
          .eq('payment_method', 'mercadopago')
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(20); // Revisar las últimas 20 pagadas por si acaso

        if (potentialInconsistencies && potentialInconsistencies.length > 0) {
          inconsistencies = potentialInconsistencies;
        }
      } catch (e) {
        console.error('Error buscando inconsistencias:', e);
      }
    }

    let res: any = await q;
    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        // Fallback si no existe paid_confirmed_at
        q = admin
          .from('checkout_sessions')
          .select(selectBase)
          .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo', 'mercadopago'])
          .order('created_at', { ascending: false })
          .limit(limit);
        if (status) q = q.eq('status', status);
        res = await q;
      }
    }
    if (res.error) {
      console.error('[ADMIN OFFLINE LIST] Error cargando sesiones:', res.error);
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    let sessions = ((res.data as any[]) ?? []) as any[];

    // Fusionar inconsistencias potenciales (evitando duplicados)
    if (inconsistencies.length > 0) {
      const existingIds = new Set(sessions.map(s => s.id));
      const newCandidates = inconsistencies.filter(i => !existingIds.has(i.id));
      // Marcar temporalmente para verificar después
      newCandidates.forEach(c => c._check_inconsistency = true);
      sessions = [...sessions, ...newCandidates];
    }

    console.log(`[ADMIN OFFLINE LIST] Sesiones encontradas (incluyendo candidatos): ${sessions.length}`, {
      total_in_db: countRes.count,
      filtered_by_status: status || 'ninguno',
      sample_ids: sessions.slice(0, 3).map((s: any) => ({
        id: s?.id,
        status: s?.status,
        payment_method: s?.payment_method,
        reference_code: s?.reference_code,
        created_at: s?.created_at,
        order_ids_count: Array.isArray(s?.order_ids) ? s.order_ids.length : 0,
      })),
    });

    // CRÍTICO: Verificar que las sesiones tienen order_ids
    const sessionsWithoutOrderIds = sessions.filter((s: any) => {
      const orderIds = ((s as any)?.order_ids as any[]) ?? [];
      return orderIds.length === 0;
    });

    if (sessionsWithoutOrderIds.length > 0) {
      console.warn('[ADMIN OFFLINE LIST] ⚠️ ADVERTENCIA: Hay sesiones sin order_ids:', {
        count: sessionsWithoutOrderIds.length,
        sessions: sessionsWithoutOrderIds.map((s: any) => ({
          id: s?.id,
          status: s?.status,
          payment_method: s?.payment_method,
        })),
      });
    }

    // ENRIQUECIMIENTO: Cargar info básica de las órdenes para detectar inconsistencias (Sesión Paid / Orden Pending)
    try {
      const allOrderIds = Array.from(new Set(sessions.flatMap((s: any) => (s?.order_ids as any[]) || [])));
      if (allOrderIds.length > 0) {
        // Loteamos de 200 en 200 por si son muchas
        const chunkSize = 200;
        let fetchedOrders: any[] = [];

        for (let i = 0; i < allOrderIds.length; i += chunkSize) {
          const chunk = allOrderIds.slice(i, i + chunkSize);
          const { data: chunkOrders, error: chunkErr } = await admin
            .from('orders')
            .select('id,status,total,payment_method,shipping_address')
            .in('id', chunk);

          if (!chunkErr && chunkOrders) {
            fetchedOrders = [...fetchedOrders, ...chunkOrders];
          }
        }

        // Obtener items de las órdenes para enriquecer con producto
        const foundOrderIds = fetchedOrders.map((o: any) => o.id);
        let itemsMap = new Map<string, any>();

        if (foundOrderIds.length > 0) {
          const { data: items } = await admin
            .from('order_items')
            .select('order_id,listing_id,title,listings(slug)')
            .in('order_id', foundOrderIds);

          if (items) {
            items.forEach((item: any) => {
              // Guardar el primer item encontrado para cada orden
              if (!itemsMap.has(item.order_id)) {
                itemsMap.set(item.order_id, {
                  title: item.title,
                  listing_id: item.listing_id,
                  slug: item.listings?.slug
                });
              }
            });
          }
        }

        // Mapear órdenes a sesiones
        const ordersMap = new Map(fetchedOrders.map((o: any) => [o.id, o]));

        // Get sellers info
        const sellerIdsSet = new Set<string>();
        if (itemsMap.size > 0) {
          const { data: listings } = await admin
            .from('listings')
            .select('id, user_id, sale_type, auction_status')
            .in('id', Array.from(itemsMap.values()).map(x => x.listing_id).filter(Boolean));

          if (listings) {
            listings.forEach((l: any) => {
              if (l.user_id) sellerIdsSet.add(l.user_id);
              // Store auction info in itemsMap temporarily to pass to session
              // Find which order used this listing
              itemsMap.forEach((val, key) => {
                if (val.listing_id === l.id) {
                  val.seller_id = l.user_id;
                  val.is_auction = l.sale_type === 'auction';
                  val.auction_status = l.auction_status;
                }
              });
            });
          }
        }

        sessions.forEach((s: any) => {
          const sOrderIds = (s?.order_ids as any[]) || [];
          s.orders_data = sOrderIds.map((oid: string) => ordersMap.get(oid)).filter(Boolean);

          // Enriquecer con datos del primer producto y snapshot del usuario
          if (s.orders_data.length > 0) {
            const first = s.orders_data[0];

            // Intentar obtener datos del producto desde el mapa de items
            const itemData = itemsMap.get(first.id);
            if (itemData) {
              s.first_product_title = itemData.title;
              s.first_product_id = itemData.listing_id;
              s.first_product_slug = itemData.slug;
              s.seller_id = itemData.seller_id;
              s.is_auction = itemData.is_auction;
            }

            // Snapshot del comprador desde la dirección de envío (si existe)
            if (first.shipping_address) {
              const sa = first.shipping_address;
              const name = sa.name || sa.full_name || (sa.first_name ? `${sa.first_name} ${sa.last_name || ''}` : null);
              if (name) s.buyer_name_snapshot = name.trim();

              if (sa.email) s.buyer_email_snapshot = sa.email;
              if (sa.phone) s.buyer_phone_snapshot = sa.phone;
            }
          }

          // Flag de inconsistencia: Sesión pagada pero órdenes no pagadas
          if (s.status === 'paid') {
            const hasPendingOrders = s.orders_data.some((o: any) => o.status !== 'paid' && o.status !== 'shipped' && o.status !== 'delivered' && o.status !== 'completed');
            if (hasPendingOrders) {
              s.inconsistency = 'paid_session_pending_orders';
            }
          }
        });
      }
    } catch (enrichErr) {
      console.error('[ADMIN OFFLINE LIST] Error enriqueciendo órdenes:', enrichErr);
    }

    // Filtrar candidatos que no resultaron tener inconsistencias
    sessions = sessions.filter(s => {
      if (s._check_inconsistency) {
        // Solo mantener si se confirmó la inconsistencia
        return s.inconsistency === 'paid_session_pending_orders';
      }
      return true; // Mantener los que venían por filtro normal
    });

    // CRÍTICO: Buscar órdenes offline que NO tienen sesión de checkout
    // Esto puede pasar si hubo un error al crear la sesión o si se crearon órdenes directamente
    console.log('[ADMIN OFFLINE LIST] Buscando órdenes sin sesión de checkout...');
    const allOrderIdsFromSessions = new Set(
      sessions.flatMap((s) => {
        const orderIds = ((s as any)?.order_ids as any[]) ?? [];
        return orderIds.map((x) => String(x || '').trim()).filter(Boolean);
      }),
    );

    console.log('[ADMIN OFFLINE LIST] Order IDs en sesiones:', {
      total_sessions: sessions.length,
      total_order_ids: allOrderIdsFromSessions.size,
      order_ids: Array.from(allOrderIdsFromSessions).slice(0, 10),
    });

    // Buscar órdenes con payment_method offline que no están en ninguna sesión
    // CRÍTICO: Buscar TODAS las órdenes offline pendientes de pago, sin restricción de tiempo
    // Solo usamos el estado válido del enum: 'pending_payment'
    let orphanOrders: any[] = [];
    try {
      const ordersQuery: any = admin
        .from('orders')
        .select('id,buyer_id,seller_id,payment_method,status,total,commission_fee,shipping_fee,shipping_option_id,created_at')
        .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo', 'mercadopago'])
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(500); // Buscar TODAS las órdenes huérfanas sin restricción de tiempo

      const ordersRes: any = await ordersQuery;
      console.log('[ADMIN OFFLINE LIST] Órdenes offline encontradas en BD:', {
        total: ordersRes.data ? (ordersRes.data as any[]).length : 0,
        error: ordersRes.error,
      });

      if (!ordersRes.error && Array.isArray(ordersRes.data)) {
        orphanOrders = ordersRes.data.filter((o: any) => {
          const orderId = String(o?.id || '').trim();
          const isOrphan = orderId && !allOrderIdsFromSessions.has(orderId);
          if (isOrphan) {
            console.log('[ADMIN OFFLINE LIST] ⚠️ Orden huérfana detectada:', {
              order_id: orderId,
              payment_method: o?.payment_method,
              status: o?.status,
              created_at: o?.created_at,
            });
          }
          return isOrphan;
        });
      } else if (ordersRes.error) {
        console.error('[ADMIN OFFLINE LIST] Error buscando órdenes huérfanas:', ordersRes.error);
      }

      // NUEVO: Incluir órdenes pagadas con PocketCash (Internal Wallet)
      // Estas órdenes NO generan checkout_session, por lo que siempre serán "huérfanas" de sesión.
      // Solo las incluimos si el filtro de status lo permite.
      const shouldIncludePocketCash = !status || status === 'paid' || status === 'approved';

      if (shouldIncludePocketCash) {
        const pocketCashQuery = await admin
          .from('orders')
          .select('id,buyer_id,seller_id,payment_method,status,total,commission_fee,shipping_fee,shipping_option_id,created_at')
          .eq('payment_method', 'pocketcash')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!pocketCashQuery.error && pocketCashQuery.data) {
          console.log(`[ADMIN OFFLINE LIST] Incluyendo ${pocketCashQuery.data.length} órdenes de PocketCash`);
          // No filtramos por 'allOrderIdsFromSessions' porque sabemos que no tienen sesión.
          orphanOrders = [...orphanOrders, ...pocketCashQuery.data];
        }
      }

    } catch (orphanErr) {
      console.warn('[ADMIN OFFLINE LIST] Error buscando órdenes huérfanas:', orphanErr);
    }

    // Crear sesiones virtuales para órdenes huérfanas
    const virtualSessions = orphanOrders.map((o: any) => {
      const orderId = String(o?.id || '').trim();
      const isPocketCash = String(o?.payment_method) === 'pocketcash';

      return {
        id: `virtual-${orderId}`,
        buyer_id: String(o?.buyer_id || ''),
        seller_id: String(o?.seller_id || ''),
        order_ids: [orderId],
        payment_method: String(o?.payment_method || ''),
        status: o?.status || 'pending', // Usar el status real de la orden
        amount: typeof o?.total === 'number' ? o.total : Number(o?.total ?? 0) || 0,
        reference_code: isPocketCash ? `WALLET-${orderId.slice(0, 8)}` : null, // Referencia amigable para wallet
        created_at: o?.created_at || new Date().toISOString(),
        payment_proof_url: null,
        payment_proof_uploaded_at: null,
        paid_confirmed_at: isPocketCash ? o?.created_at : null,
        paid_confirmed_by_name: isPocketCash ? 'Sistema' : null,
        _is_virtual: true, // Marca para identificar sesiones virtuales
        _needs_sync: !isPocketCash, // PocketCash no necesita sync de sesión porque es nativo
      };
    });

    // Combinar sesiones reales y virtuales
    const allSessions = [...sessions, ...virtualSessions];

    // Enriquecer con órdenes + primer producto (listing_id/title) + breakdown (comisión/envío/neto)
    const allOrderIds = Array.from(
      new Set(
        allSessions
          .flatMap((s) => (((s as any)?.order_ids as any[]) ?? []) as any[])
          .map((x) => String(x || '').trim())
          .filter(Boolean),
      ),
    );

    const ordersById: Record<
      string,
      {
        id: string;
        total: number;
        commission_fee: number;
        shipping_fee: number;
        shipping_subsidy: number;
        shipping_option_id?: string | null;
        shipping_carrier?: string | null;
        shipping_label_url?: string | null;
        shipping_by_seller?: boolean | null;
        subtotal?: number;
        created_at?: string | null;
        seller_id?: string | null;
        order_source?: string | null;
      }
    > = {};

    if (allOrderIds.length > 0) {
      const oRes: any = await admin
        .from('orders')
        .select('id,total,subtotal,commission_fee,shipping_fee,shipping_subsidy,shipping_option_id,shipping_carrier,shipping_label_url,shipping_by_seller,shipping_method,created_at,seller_id,order_source')
        .in('id', allOrderIds)
        .limit(5000);
      if (!oRes.error && Array.isArray(oRes.data)) {
        for (const o of oRes.data as any[]) {
          const id = String(o?.id || '').trim();
          if (!id) continue;
          ordersById[id] = {
            id,
            total: typeof o?.total === 'number' ? o.total : Number(o?.total ?? 0) || 0,
            subtotal: typeof o?.subtotal === 'number' ? o.subtotal : Number(o?.subtotal ?? 0) || 0,
            commission_fee: typeof o?.commission_fee === 'number' ? o.commission_fee : Number(o?.commission_fee ?? 0) || 0,
            shipping_fee: typeof o?.shipping_fee === 'number' ? o.shipping_fee : Number(o?.shipping_fee ?? 0) || 0,
            shipping_subsidy: typeof o?.shipping_subsidy === 'number' ? o.shipping_subsidy : Number(o?.shipping_subsidy ?? 0) || 0,
            shipping_option_id: o?.shipping_option_id,
            shipping_carrier: o?.shipping_carrier,
            shipping_label_url: (o as any)?.shipping_label_url ?? null,
            shipping_by_seller: (o as any)?.shipping_by_seller ?? null,
            created_at: (o?.created_at as string | undefined) ?? null,
            seller_id: o?.seller_id ? String(o.seller_id).trim() : null,
            order_source: o?.order_source ? String(o.order_source).trim() : null,
          };
        }
      }
    }

    const firstProductByOrderId: Record<string, { listing_id?: string | null; title?: string | null }> = {};
    const productsByOrderId: Record<string, { listing_id?: string | null; title?: string | null }[]> = {};
    if (allOrderIds.length > 0) {
      // Best-effort: listing_id puede no existir en algunos schemas
      let itRes: any = await admin
        .from('order_items')
        .select('order_id,listing_id,title')
        .in('order_id', allOrderIds)
        .order('created_at', { ascending: true })
        .limit(5000);
      if (itRes?.error) {
        const code = String((itRes.error as any)?.code || '');
        const msg = String((itRes.error as any)?.message || '').toLowerCase();
        if (code === '42703' || msg.includes('column')) {
          itRes = await admin.from('order_items').select('order_id,title').in('order_id', allOrderIds).limit(5000);
        }
      }
      if (!itRes?.error && Array.isArray(itRes.data)) {
        for (const it of itRes.data as any[]) {
          const oid = String(it?.order_id || '').trim();
          if (!oid) continue;
          const p = {
            listing_id: (it as any)?.listing_id ? String((it as any).listing_id).trim() : null,
            title: (it as any)?.title ? String((it as any).title).trim() : null,
          };
          if (!productsByOrderId[oid]) productsByOrderId[oid] = [];
          productsByOrderId[oid].push(p);

          if (!firstProductByOrderId[oid]) firstProductByOrderId[oid] = p;
        }
      }
    }

    // Resolver thumbnails de listings involucrados
    const listingIdsSet = new Set<string>();
    // IDs desde los productos por orden
    for (const arr of Object.values(productsByOrderId)) {
      for (const p of arr) {
        const lid = String(p?.listing_id || '').trim();
        if (lid) listingIdsSet.add(lid);
      }
    }
    // IDs desde sesiones pre-enriquecidas (si existen)
    for (const s of sessions as any[]) {
      const fid = String((s as any)?.first_product_id || '').trim();
      if (fid) listingIdsSet.add(fid);
    }
    const listingThumbById: Record<string, string> = {};
    const productTypeByOrderIdMap: Record<string, string> = {};
    const productTypeByListingId: Record<string, string> = {};
    if (listingIdsSet.size > 0) {
      const ids = Array.from(listingIdsSet);
      let lq: any = await admin.from('listings').select('id,public_id,images,product_type,sale_type,user_id,free_shipping,shipping_by_seller,weight_kg,length_cm,width_cm,height_cm,shipping_price').in('id', ids).limit(5000);
      if (!lq.error && Array.isArray(lq.data)) {
        for (const row of lq.data as any[]) {
          const iid = String(row?.id || '').trim();
          const pid = String(row?.public_id || '').trim();
          let imgs: string[] = [];
          const raw = (row as any)?.images;
          if (Array.isArray(raw)) {
            imgs = raw.map((x: any) => String(x || '').trim()).filter(Boolean);
          } else if (typeof raw === 'string') {
            const sraw = raw.trim();
            try {
              const parsed = JSON.parse(sraw);
              if (Array.isArray(parsed)) imgs = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
            } catch {
              if (sraw.startsWith('http') || sraw.startsWith('/')) imgs = [sraw];
            }
          }
          const first = imgs[0] || '';
          if (first) {
            if (iid) listingThumbById[iid] = first;
            if (pid) listingThumbById[pid] = first;
          }
          // Track product_type
          const pt = String((row as any)?.product_type || 'physical');
          if (iid) productTypeByListingId[iid] = pt;
          // Track sale_type for auction detection
          const st = String((row as any)?.sale_type || 'direct');
          if (iid) (productTypeByListingId as any)[`sale_${iid}`] = st;
          // Track seller (user_id) per listing for seller_id enrichment
          const sellUid = String((row as any)?.user_id || '').trim();
          if (iid && sellUid) (productTypeByListingId as any)[`seller_${iid}`] = sellUid;
          // Track free_shipping and shipping_by_seller per listing for correct enrichment
          if (iid) {
            (productTypeByListingId as any)[`freeShip_${iid}`] = Boolean((row as any)?.free_shipping);
            (productTypeByListingId as any)[`sellerShip_${iid}`] = Boolean((row as any)?.shipping_by_seller);
            // Track weight/dims/shipping_price for shipping cost calculation
            (productTypeByListingId as any)[`weight_${iid}`] = Number((row as any)?.weight_kg || 0);
            (productTypeByListingId as any)[`length_${iid}`] = Number((row as any)?.length_cm || 0);
            (productTypeByListingId as any)[`width_${iid}`] = Number((row as any)?.width_cm || 0);
            (productTypeByListingId as any)[`height_${iid}`] = Number((row as any)?.height_cm || 0);
            (productTypeByListingId as any)[`shippingPrice_${iid}`] = Number((row as any)?.shipping_price || 0);
          }
        }
      }

      // Build productTypeByOrderId map
      for (const [oid, items] of Object.entries(productsByOrderId)) {
        const hasDigital = items.some((p: any) => {
          const lid = String(p?.listing_id || '').trim();
          return lid && productTypeByListingId[lid] === 'digital';
        });
        productTypeByOrderIdMap[oid] = hasDigital ? 'digital' : 'physical';
      }
    }

    // CRÍTICO: Usar allSessions en lugar de sessions para incluir sesiones virtuales
    const enriched = allSessions.map((s) => {
      // CRÍTICO: Asegurar que orderIds siempre esté definido
      const orderIdsRaw = (s as any)?.order_ids;
      const orderIds = Array.isArray(orderIdsRaw)
        ? orderIdsRaw.map((x: any) => String(x || '').trim()).filter(Boolean)
        : [];

      let commission = 0;
      let shippingBuyer = 0;
      let shippingSubsidy = 0;
      let ordersTotal = 0;
      let hasPickup = false;
      let netOrdersTotal = 0;

      // CRÍTICO: Solo procesar si hay orderIds
      if (orderIds.length > 0) {
        for (const oid of orderIds) {
          const o = ordersById[oid];
          if (!o) continue;
          ordersTotal += Number(o.total || 0) || 0;
          commission += Number(o.commission_fee || 0) || 0;
          const sFee = Number(o.shipping_fee || 0) || 0;
          const sSub = Number(o.shipping_subsidy || 0) || 0;
          if (o.shipping_option_id === 'pickup' || o.shipping_carrier === 'pickup') {
            hasPickup = true;
          } else {
            shippingBuyer += sFee;
            shippingSubsidy += sSub;
          }
          // Derivar shipping_by_seller para evitar que órdenes antiguas regalen el envío al vendedor.
          const opt = String(o.shipping_option_id || '').trim().toLowerCase();
          const carr = String(o.shipping_carrier || '').trim().toLowerCase();
          const pickup = opt === 'pickup' || carr === 'pickup';
          // Check listing-level free_shipping: if listing has free_shipping=true and shipping_by_seller=false,
          // it's GoVendy free shipping — seller MUST pay, not receive shipping.
          const orderListingId = String((o as any)?.listing_id || firstProductByOrderId[o.id]?.listing_id || '').trim();
          const listingFreeShip = Boolean((productTypeByListingId as any)?.[`freeShip_${orderListingId}`]);
          const listingSellerShip = Boolean((productTypeByListingId as any)?.[`sellerShip_${orderListingId}`]);
          const isGoVendyFreeShipping = listingFreeShip && !listingSellerShip;
          const hasSignals =
            (!pickup && Boolean(opt) && opt !== 'pickup') ||
            (!pickup && carr === 'gopocket') ||
            Boolean((o as any)?.shipping_label_url) ||
            Number(o.shipping_subsidy || 0) > 0 ||
            (!pickup && Number(o.shipping_fee || 0) > 0) ||
            isGoVendyFreeShipping; // ⚠️ Listing-level signal: GoVendy gratis
          const o2 = {
            ...o,
            shipping_by_seller:
              o.shipping_by_seller === true && !hasSignals ? true : false,
            // Force gopocket carrier for GoVendy free shipping if missing on order
            ...(isGoVendyFreeShipping && !carr ? { shipping_carrier: 'gopocket' } : {}),
            // ⚠️ CRITICAL: Calculate and inject shipping_subsidy when GoVendy free shipping
            // but order has no subsidy (orders created before the fix)
            ...(isGoVendyFreeShipping && Number(o.shipping_subsidy || 0) === 0 ? (() => {
              // Calculate GoVendy shipping cost from listing weight
              const lWeight = Number((productTypeByListingId as any)?.[`weight_${orderListingId}`] || 0) || 1;
              const lLen = Number((productTypeByListingId as any)?.[`length_${orderListingId}`] || 0) || 10;
              const lWid = Number((productTypeByListingId as any)?.[`width_${orderListingId}`] || 0) || 10;
              const lH = Number((productTypeByListingId as any)?.[`height_${orderListingId}`] || 0) || 10;
              const lShipPrice = Number((productTypeByListingId as any)?.[`shippingPrice_${orderListingId}`] || 0);
              const volW = (lLen * lWid * lH) / 5000;
              const finalWeight = Math.max(lWeight, volW);
              const DEFAULT_WEIGHT_RANGES = [
                { max_weight_kg: 1, price: 175 },
                { max_weight_kg: 5, price: 195 },
                { max_weight_kg: 10, price: 235 },
                { max_weight_kg: 15, price: 255 },
                { max_weight_kg: 20, price: 275 },
                { max_weight_kg: 25, price: 300 },
                { max_weight_kg: 30, price: 325 },
              ];
              let calcCost = lShipPrice > 0 ? lShipPrice : 175;
              if (!(lShipPrice > 0)) {
                const match = DEFAULT_WEIGHT_RANGES.find(r => finalWeight <= r.max_weight_kg);
                calcCost = match ? match.price : DEFAULT_WEIGHT_RANGES[DEFAULT_WEIGHT_RANGES.length - 1].price;
              }
              return { shipping_subsidy: calcCost };
            })() : {}),
          };
          netOrdersTotal += payoutNet(o2 as any);
          // Also accumulate the calculated subsidy for display
          if (isGoVendyFreeShipping && Number(o.shipping_subsidy || 0) === 0) {
            const injectedSub = Number((o2 as any).shipping_subsidy || 0);
            if (injectedSub > 0) shippingSubsidy += injectedSub;
          }
        }
      }

      const firstOrderId = orderIds.length > 0 ? orderIds[0] : '';
      const firstProduct = firstOrderId ? firstProductByOrderId[firstOrderId] ?? null : null;

      const productsAll: { listing_id?: string | null; title?: string | null }[] = [];
      const seenProducts = new Set<string>();

      // CRÍTICO: Solo procesar productos si hay orderIds
      if (orderIds.length > 0) {
        for (const oid of orderIds) {
          const ps = productsByOrderId[oid] ?? [];
          for (const p of ps) {
            const key = `${String(p?.listing_id || '').trim()}::${String(p?.title || '').trim()}`;
            if (seenProducts.has(key)) continue;
            seenProducts.add(key);
            productsAll.push(p);
          }
        }
      }

      const base = {
        ...s,
        orders_total: ordersTotal,
        commission_total: commission,
        shipping_total: shippingBuyer,
        shipping_subsidy_total: shippingSubsidy,
        shipping_gross_total: shippingBuyer + shippingSubsidy,
        net_total: netOrdersTotal,
        first_product: firstProduct,
        orders_count: orderIds.length,
        has_pickup: hasPickup,
        products: productsAll.slice(0, 20),
        products_count: productsAll.length,
        is_virtual: Boolean((s as any)?._is_virtual),
        needs_sync: Boolean((s as any)?._needs_sync),
        // Shipping metadata from first order — corrected with listing-level GoVendy detection
        shipping_by_seller: (() => {
          for (const oid of orderIds) {
            const o = ordersById[oid];
            if (!o) continue;
            // Check listing-level free_shipping to override incorrect order data
            const lid = String((o as any)?.listing_id || firstProductByOrderId[o.id]?.listing_id || '').trim();
            const lFreeShip = Boolean((productTypeByListingId as any)?.[`freeShip_${lid}`]);
            const lSellerShip = Boolean((productTypeByListingId as any)?.[`sellerShip_${lid}`]);
            if (lFreeShip && !lSellerShip) return false; // GoVendy gratis → seller does NOT manage

            // Trust the explicit shipping_by_seller flag from the order
            // The listing-level flag is the ultimate fallback
            if (o.shipping_by_seller === true) return true;
            if (lSellerShip) return true;

            return false;
          }
          return false;
        })(),
        shipping_carrier: (() => {
          for (const oid of orderIds) {
            const o = ordersById[oid];
            if (!o) continue;
            // Force gopocket carrier for GoVendy free shipping if missing on order
            const lid = String((o as any)?.listing_id || firstProductByOrderId[o.id]?.listing_id || '').trim();
            const lFreeShip = Boolean((productTypeByListingId as any)?.[`freeShip_${lid}`]);
            const lSellerShip = Boolean((productTypeByListingId as any)?.[`sellerShip_${lid}`]);
            if (lFreeShip && !lSellerShip && !String(o.shipping_carrier || '').trim()) return 'gopocket';
            if (o?.shipping_carrier) return String(o.shipping_carrier).trim();
          }
          return '';
        })(),
        // Flag for frontend: listing has GoVendy free shipping (seller pays from earnings)
        is_gopocket_free: (() => {
          for (const oid of orderIds) {
            const o = ordersById[oid];
            if (!o) continue;
            const lid = String((o as any)?.listing_id || firstProductByOrderId[o.id]?.listing_id || '').trim();
            const lFreeShip = Boolean((productTypeByListingId as any)?.[`freeShip_${lid}`]);
            const lSellerShip = Boolean((productTypeByListingId as any)?.[`sellerShip_${lid}`]);
            if (lFreeShip && !lSellerShip) return true;
          }
          return false;
        })(),
        shipping_option_id: (() => {
          for (const oid of orderIds) {
            const o = ordersById[oid];
            if (o?.shipping_option_id) return String(o.shipping_option_id).trim();
          }
          return '';
        })(),
        is_digital: (() => {
          // Check if any order in this session has a digital product
          const oids = Array.isArray((s as any)?.order_ids) ? (s as any).order_ids : [];
          return oids.some((oid: string) => productTypeByOrderIdMap[String(oid || '').trim()] === 'digital');
        })(),
      };
      // Completar títulos/IDs si faltan (órdenes huérfanas)
      if (!('first_product_title' in base) && firstProduct?.title) {
        (base as any).first_product_title = firstProduct.title;
      }
      if (!('first_product_id' in base) && firstProduct?.listing_id) {
        (base as any).first_product_id = firstProduct.listing_id;
      }
      // Agregar thumbnail si es posible
      const thumbKey = String((base as any).first_product_id || '').trim();
      if (thumbKey && listingThumbById[thumbKey]) {
        (base as any).first_product_thumb = listingThumbById[thumbKey];
      }
      // Mark as auction if the first product's listing is an auction
      if (!('is_auction' in base) || !(base as any).is_auction) {
        const fpId = String((base as any).first_product_id || '').trim();
        if (fpId && (productTypeByListingId as any)[`sale_${fpId}`] === 'auction') {
          (base as any).is_auction = true;
        }
      }
      // Use order_source as authoritative fallback for auction detection
      if (!('order_source' in base)) {
        for (const oid of orderIds) {
          const o = ordersById[oid];
          if (o?.order_source) {
            (base as any).order_source = o.order_source;
            // If order_source says auction but is_auction is false, fix it
            if (o.order_source === 'auction' && !(base as any).is_auction) {
              (base as any).is_auction = true;
            }
            break;
          }
        }
      }
      // Ensure seller_id is set from multiple fallback sources
      if (!(base as any).seller_id) {
        // Fallback 1: from listing's user_id
        const fpId2 = String((base as any).first_product_id || '').trim();
        const sellerFromListing = fpId2 ? (productTypeByListingId as any)[`seller_${fpId2}`] : null;
        if (sellerFromListing) {
          (base as any).seller_id = sellerFromListing;
        } else {
          // Fallback 2: from the orders table directly
          for (const oid of orderIds) {
            const orderData = ordersById[oid];
            if (orderData?.seller_id) {
              (base as any).seller_id = orderData.seller_id;
              break;
            }
          }
        }
      }
      return base;
    });

    // CRÍTICO: Verificar que virtualSessions esté definido antes de usarlo
    const virtualSessionsCount = Array.isArray(virtualSessions) ? virtualSessions.length : 0;
    const sessionsCount = Array.isArray(sessions) ? sessions.length : 0;
    console.log(`[ADMIN OFFLINE LIST] Total sesiones enriquecidas: ${enriched.length} (${sessionsCount} reales, ${virtualSessionsCount} virtuales)`);

    // Enrich with user profiles for display (buyers AND sellers)
    const userIdSet = new Set<string>();
    enriched.forEach((s: any) => {
      if (s.buyer_id) userIdSet.add(s.buyer_id);
      if (s.user_id) userIdSet.add(s.user_id);
      if (s.seller_id) userIdSet.add(s.seller_id);
    });
    const profilesMap: Record<string, { full_name: string; email: string }> = {};
    const userIdArr = Array.from(userIdSet);
    if (userIdArr.length > 0) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, full_name, first_name, last_name, email, nickname')
        .in('id', userIdArr);
      if (profs) {
        for (const p of profs) {
          const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.nickname || '';
          profilesMap[p.id] = { full_name: name, email: p.email || '' };
        }
      }
      const missingProfileIds = userIdArr.filter(id => !profilesMap[id]?.full_name || !profilesMap[id]?.email);
      for (const id of missingProfileIds.slice(0, 50)) {
        try {
          const { data: { user } } = await admin.auth.admin.getUserById(id);
          if (user) {
            const meta = user.user_metadata || {};
            const authName = meta.full_name || meta.name || user.email?.split('@')[0] || '';
            profilesMap[id] = {
              full_name: profilesMap[id]?.full_name || authName,
              email: profilesMap[id]?.email || user.email || '',
            };
          }
        } catch { /* ignore */ }
      }
    }
    const resp = NextResponse.json({ ok: true, sessions: enriched, profiles: profilesMap });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

