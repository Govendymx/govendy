'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils/format';

interface T1Quote {
  rate_id: string;
  carrier: string;
  service: string;
  total_price: number;
  currency: string;
  estimated_delivery_days: number;
}

export default function EnviosPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [sellerZip, setSellerZip] = useState<string>('');
  const [sellerPlan, setSellerPlan] = useState<string>('basic');
  const [quotesByOrderId, setQuotesByOrderId] = useState<Record<string, { loading: boolean, quotes: T1Quote[], error: string | null }>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      // Cargar perfil del vendedor para obtener CP y plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('zip_code, plan_type')
        .eq('id', userId)
        .single();
      
      const zip = profile?.zip_code || '';
      const plan = profile?.plan_type || 'basic';
      setSellerZip(zip);
      setSellerPlan(plan);

      // Cargar ventas (orders) usando la API robusta
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/orders/seller-dashboard?limit=20&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      const sales = json?.orders || [];

      if (sales && sales.length > 0) {
        const orderIds = sales.map((s: any) => s.id);
        const buyerIds = Array.from(new Set(sales.map((s: any) => s.buyer_id).filter(Boolean)));

        // Enriquecer con profiles de compradores (con fallback seguro)
        const { data: buyersData, error: buyersErr } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, username, zip_code')
          .in('id', buyerIds);
        
        let finalBuyers: any[] = buyersData || [];
        if (buyersErr) {
          // Si falla por columna zip_code inexistente u otra cosa
          const fb = await supabase.from('profiles').select('id, full_name').in('id', buyerIds);
          finalBuyers = fb.data || [];
        }
        
        const buyerMap: Record<string, any> = {};
        finalBuyers.forEach((b: any) => {
          buyerMap[b.id] = {
            ...b,
            full_name: b.full_name || b.nickname || b.username || `Usuario ${b.id.substring(0,6)}`
          };
        });

        // Cargar order_items SIN join directo a listings (para evitar bloqueos RLS)
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, listing_id, quantity, title')
          .in('order_id', orderIds);

        // Cargar listings separados
        const listingIds = Array.from(new Set(items?.map((it: any) => it.listing_id).filter(Boolean)));
        let listingsMap: Record<string, any> = {};
        if (listingIds.length > 0) {
          const { data: listingsData } = await supabase
            .from('listings')
            .select('id, title, images, weight_kg, length_cm, width_cm, height_cm')
            .in('id', listingIds);
          listingsData?.forEach((l: any) => { listingsMap[l.id] = l; });
        }

        const itemsMap: Record<string, any[]> = {};
        items?.forEach((item: any) => {
          if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
          itemsMap[item.order_id].push({
             ...item,
             listings: listingsMap[item.listing_id] || { title: item.title }
          });
        });

        const enrichedSales = sales.map((s: any) => {
          const sItems = itemsMap[s.id] || [];
          let totalWeight = 0;
          let maxL = 10, maxW = 10, maxH = 10;
          
          sItems.forEach((it: any) => {
            const l = it.listings;
            if (l) {
              const w = Number(l.weight_kg) || 1;
              totalWeight += w * (it.quantity || 1);
              maxL = Math.max(maxL, Number(l.length_cm) || 10);
              maxW = Math.max(maxW, Number(l.width_cm) || 10);
              maxH += (Number(l.height_cm) || 10) * (it.quantity || 1);
            }
          });

          // Obtener CP y Nombre de la dirección de envío
          let destZip = '';
          let addressName = '';
          if (s.shipping_address) {
            try {
              const addr = typeof s.shipping_address === 'string' ? JSON.parse(s.shipping_address) : s.shipping_address;
              destZip = addr.zip_code || addr.zip || '';
              addressName = addr.full_name || `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || '';
            } catch (e) {
              // Ignore
            }
          }
          if (!destZip && buyerMap[s.buyer_id]?.zip_code) {
            destZip = buyerMap[s.buyer_id].zip_code;
          }

          return {
            ...s,
            buyer: buyerMap[s.buyer_id],
            addressName,
            items: sItems,
            destZip,
            dims: { weight_kg: totalWeight || 1, length_cm: maxL, width_cm: maxW, height_cm: maxH }
          };
        });

        setOrders(enrichedSales);

        // Disparar cotizaciones automáticamente
        enrichedSales.forEach((order: any) => {
          if (zip && order.destZip) {
            quoteShipping(order.id, zip, order.destZip, order.dims.weight_kg, order.dims.length_cm, order.dims.width_cm, order.dims.height_cm, plan);
          } else {
            setQuotesByOrderId(prev => ({ ...prev, [order.id]: { loading: false, quotes: [], error: 'Falta código postal de origen o destino' }}));
          }
        });
      }
    } catch (e) {
      console.error('Error loading envios:', e);
    } finally {
      setLoading(false);
    }
  };

  const quoteShipping = async (orderId: string, origin_zip: string, dest_zip: string, weight_kg: number, length_cm: number, width_cm: number, height_cm: number, plan: string) => {
    setQuotesByOrderId(prev => ({ ...prev, [orderId]: { loading: true, quotes: [], error: null } }));
    try {
      const res = await fetch('/api/shipping/t1/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_zip,
          dest_zip,
          weight_kg,
          length_cm,
          width_cm,
          height_cm,
          seller_plan: plan
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cotizando');
      if (data.reason === 'plan_no_access') throw new Error('plan_no_access');
      
      setQuotesByOrderId(prev => ({ ...prev, [orderId]: { loading: false, quotes: data.quotes || [], error: null } }));
    } catch (err: any) {
      setQuotesByOrderId(prev => ({ ...prev, [orderId]: { loading: false, quotes: [], error: err.message } }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-emerald"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">🚚 Envíos GoVendy</h1>
        <p className="mt-2 text-gray-600">
          Gestiona las cotizaciones automáticas para tus ventas mediante <strong className="text-brand-emerald">T1 Envíos</strong>.
        </p>
      </div>

      {!sellerZip && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                Tu perfil no tiene un código postal configurado. Configúralo en <strong>Mi Perfil</strong> para que las cotizaciones funcionen correctamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl shadow-sm border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas recientes</h3>
          <p className="mt-1 text-sm text-gray-500">Cuando realices una venta, aparecerá aquí con sus opciones de envío.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const quoteData = quotesByOrderId[order.id];
            
            return (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="border-b border-gray-100 bg-gray-50/50 p-4 sm:px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Orden #{order.id.slice(0,8)} • {new Date(order.created_at).toLocaleDateString('es-MX')}
                    </div>
                    <div className="font-semibold text-gray-900">
                      Comprador: <span className="text-brand-emerald">{order.buyer?.full_name || order.addressName || `#${order.id.slice(0,8)}`}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm ring-1 ring-gray-200">
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Origen</div>
                      <div className="text-sm font-mono font-medium text-gray-800">{sellerZip || '----'}</div>
                    </div>
                    <div className="text-gray-300">→</div>
                    <div className="text-center">
                      <div className="text-[10px] text-gray-500 uppercase font-bold">Destino</div>
                      <div className="text-sm font-mono font-medium text-gray-800">{order.destZip || '----'}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
                  {/* Detalles de productos */}
                  <div className="flex-1 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Productos ({order.items?.length || 0})</h3>
                    {order.items?.map((item: any, i: number) => {
                      const img = Array.isArray(item.listings?.images) ? item.listings.images[0] : null;
                      return (
                        <div key={i} className="flex gap-4 items-center">
                          {img ? (
                            <img src={img} alt="" className="w-16 h-16 object-cover rounded-xl border border-gray-100" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-xl border border-gray-100 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">Sin img</span>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 line-clamp-2">{item.listings?.title || 'Producto'}</p>
                            <p className="text-sm text-gray-500">Cant: {item.quantity}</p>
                          </div>
                        </div>
                      )
                    })}
                    <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      Peso volumétrico: {order.dims?.weight_kg}kg ({order.dims?.length_cm}x{order.dims?.width_cm}x{order.dims?.height_cm}cm)
                    </div>
                  </div>

                  {/* Cotizaciones T1 en formato Lista Compacta */}
                  <div className="flex-1 lg:max-w-sm bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <svg className="w-4 h-4 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Opciones de Envío
                      </h3>
                      {quoteData?.loading && <div className="w-3 h-3 border-2 border-brand-emerald border-t-transparent rounded-full animate-spin"></div>}
                    </div>

                    {quoteData?.error && (
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                        {quoteData.error === 'plan_no_access' ? 'Tu plan no incluye acceso a T1 Envíos.' : quoteData.error}
                      </div>
                    )}

                    {!quoteData?.loading && !quoteData?.error && quoteData?.quotes?.length === 0 && (
                      <div className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No hay opciones para esta ruta.</div>
                    )}

                    <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                      {quoteData?.quotes?.map((q: any, i: number) => (
                        <div key={i} className="bg-white p-3 flex justify-between items-center hover:bg-gray-50 transition-colors cursor-pointer group">
                          <div className="flex flex-col">
                            <div className="text-sm font-bold text-gray-900 group-hover:text-brand-emerald transition-colors flex items-center gap-1.5">
                              {q.carrier_name}
                              <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{q.service_level}</span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">Entrega est. {q.delivery_days} días</div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div className="text-sm font-black text-gray-900">{formatMoney(q.cost)}</div>
                            <button className="text-[10px] font-bold text-white bg-brand-emerald px-2 py-1 rounded hover:bg-emerald-600 transition-colors shadow-sm">
                              Elegir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
