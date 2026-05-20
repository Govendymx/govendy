'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils/format';

interface T1Quote {
  rate_id?: string;
  carrier?: string;
  service?: string;
  total_price?: number;
  currency?: string;
  estimated_delivery_days?: number;
  carrier_name: string;
  service_level: string;
  cost: number;
  delivery_days: number;
  logo_url?: string;
}

export default function EnviosPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [sellerZip, setSellerZip] = useState<string>('');
  const [sellerPlan, setSellerPlan] = useState<string>('basic');
  const [quotesByOrderId, setQuotesByOrderId] = useState<Record<string, { loading: boolean, quotes: T1Quote[], error: string | null }>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5; // Mostrar 5 ventas por página para mantener la lista compacta y limpia

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

      // Cargar ventas (orders) usando la API robusta, aumentando el límite a 100 para paginación
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/orders/seller-dashboard?limit=100&t=${Date.now()}`, {
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
        setCurrentPage(1); // Reset a primera página
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

  // Cargar cotizaciones de envío de forma inteligente SOLO para la página actual visible
  useEffect(() => {
    if (orders.length === 0) return;

    const indexOfLastOrder = currentPage * pageSize;
    const indexOfFirstOrder = indexOfLastOrder - pageSize;
    const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);

    currentOrders.forEach((order) => {
      // Evitar llamadas duplicadas si ya está cargando o ya se cotizó
      if (quotesByOrderId[order.id]) return;

      if (sellerZip && order.destZip) {
        quoteShipping(order.id, sellerZip, order.destZip, order.dims.weight_kg, order.dims.length_cm, order.dims.width_cm, order.dims.height_cm, sellerPlan);
      } else {
        setQuotesByOrderId(prev => ({ ...prev, [order.id]: { loading: false, quotes: [], error: 'Falta código postal de origen o destino' } }));
      }
    });
  }, [currentPage, orders, sellerZip, sellerPlan]);

  // Paginación
  const indexOfLastOrder = currentPage * pageSize;
  const indexOfFirstOrder = indexOfLastOrder - pageSize;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(orders.length / pageSize);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-emerald"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">🚚 Envíos GoVendy</h1>
          <p className="mt-2 text-gray-600">
            Gestiona las cotizaciones automáticas para tus ventas mediante <strong className="text-brand-emerald">T1 Envíos</strong>.
          </p>
        </div>
      </div>

      {!sellerZip && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-xs">
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
        <div className="text-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-4 text-base font-bold text-gray-900">No hay ventas recientes</h3>
          <p className="mt-1.5 text-sm text-gray-500">Cuando realices una venta, aparecerá aquí con sus opciones de envío.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {currentOrders.map((order) => {
            const quoteData = quotesByOrderId[order.id];
            const isExpanded = expandedOrders[order.id] ?? false; // Cerrado por defecto como pide el usuario
            
            return (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* Cabecera / Vista Compacta (Siempre Visible) */}
                <div 
                  className="border-b border-gray-100 bg-gray-50/30 p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 cursor-pointer hover:bg-gray-50/70 transition-colors"
                  onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !isExpanded }))}
                >
                  {/* Número de Venta & ID */}
                  <div className="flex-1 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {new Date(order.created_at).toLocaleDateString('es-MX')}
                    </div>
                    <Link href={`/dashboard/ventas?order=${order.id}`} className="block group">
                      <span className="font-extrabold text-gray-900 text-lg group-hover:text-brand-emerald transition-colors block">
                        Venta #{order.id.slice(0,8).toUpperCase()}
                      </span>
                      <span className="font-mono text-xs text-gray-400 block break-all group-hover:text-brand-emerald transition-colors">
                        ID: {order.id}
                      </span>
                    </Link>
                  </div>

                  {/* Nombre del Comprador */}
                  <div className="flex-1 min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Comprador
                    </div>
                    <Link 
                      href={`/profile/${order.buyer_id}`} 
                      className="font-bold text-brand-emerald hover:text-emerald-700 transition-colors text-base hover:underline block"
                    >
                      {order.addressName || order.buyer?.full_name || `Usuario #${order.id.slice(0,8)}`}
                    </Link>
                  </div>

                  {/* Artículos Comprados (Lista Compacta Siempre Visible) */}
                  <div className="flex-1 min-w-[240px]" onClick={(e) => e.stopPropagation()}>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Artículos ({order.items?.length || 0})
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {order.items?.map((item: any, i: number) => {
                        const img = Array.isArray(item.listings?.images) ? item.listings.images[0] : null;
                        return (
                          <Link 
                            key={i} 
                            href={`/listings/${item.listing_id}`}
                            className="flex items-center gap-2 hover:bg-white p-1 rounded-xl border border-transparent hover:border-gray-100 hover:shadow-xs transition-all group"
                          >
                            {img ? (
                              <img src={img} alt="" className="w-8 h-8 object-cover rounded-lg border border-gray-100" />
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-100">
                                <span className="text-gray-400 text-[9px] font-bold">S/I</span>
                              </div>
                            )}
                            <div className="text-xs min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 group-hover:text-brand-emerald line-clamp-1 transition-colors">
                                {item.listings?.title || 'Producto'}
                              </p>
                              <p className="text-[10px] text-gray-400 font-medium">Cant: {item.quantity}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Origen/Destino & Botón de Expandir */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center w-full lg:w-auto gap-4 self-stretch lg:self-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-gray-100">
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-2xl shadow-sm ring-1 ring-gray-150">
                      <div className="text-center">
                        <div className="text-[8px] text-gray-400 uppercase font-bold">Origen</div>
                        <div className="text-xs font-mono font-bold text-gray-700">{sellerZip || '----'}</div>
                      </div>
                      <div className="text-gray-300 text-xs">→</div>
                      <div className="text-center">
                        <div className="text-[8px] text-gray-400 uppercase font-bold">Destino</div>
                        <div className="text-xs font-mono font-bold text-gray-700">{order.destZip || '----'}</div>
                      </div>
                    </div>
                    
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-brand-emerald text-xs font-extrabold text-gray-600 hover:text-brand-emerald bg-white transition-all shadow-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedOrders(prev => ({ ...prev, [order.id]: !isExpanded }));
                      }}
                    >
                      <span>{isExpanded ? 'Ocultar cotización' : 'Cotizar / Detalles'}</span>
                      <svg className={`w-4 h-4 text-gray-400 transform transition-transform duration-250 ${isExpanded ? 'rotate-180 text-brand-emerald' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Sección Desplegable (Solo visible al expandir) */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6 bg-white animate-in slide-in-from-top-2 border-t border-gray-100">
                    {/* Detalles del paquete y envío */}
                    <div className="md:w-1/3 space-y-4">
                      <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Detalles del Envío</h4>
                        <div className="space-y-2.5 text-xs text-gray-600">
                          <div className="flex justify-between border-b border-gray-100 pb-1.5">
                            <span className="font-medium">Peso volumétrico:</span>
                            <span className="font-extrabold text-gray-900">{order.dims?.weight_kg} kg</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1.5">
                            <span className="font-medium">Dimensiones:</span>
                            <span className="font-extrabold text-gray-900">{order.dims?.length_cm}x{order.dims?.width_cm}x{order.dims?.height_cm} cm</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-500">Dirección del comprador:</span>
                            <span className="font-bold text-gray-900 leading-normal break-words">{order.addressName || order.buyer?.full_name || 'No especificada'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cotizaciones T1 */}
                    <div className="flex-1">
                      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                            <svg className="w-4 h-4 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Opciones de Envío (T1 Envíos)
                          </h4>
                          {quoteData?.loading && <div className="w-3.5 h-3.5 border-2 border-brand-emerald border-t-transparent rounded-full animate-spin"></div>}
                        </div>

                        {quoteData?.error && (
                          <div className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                            {quoteData.error === 'plan_no_access' ? 'Tu plan no incluye acceso a T1 Envíos.' : quoteData.error}
                          </div>
                        )}

                        {!quoteData?.loading && !quoteData?.error && (!quoteData?.quotes || quoteData?.quotes?.length === 0) && (
                          <div className="text-xs text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            No hay opciones disponibles para esta ruta.
                          </div>
                        )}

                        {!quoteData?.loading && !quoteData?.error && quoteData?.quotes && quoteData.quotes.length > 0 && (
                          <div className="space-y-2 border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
                            {quoteData.quotes.map((q: any, i: number) => (
                              <div key={i} className="bg-white p-3.5 flex justify-between items-center hover:bg-gray-50/70 transition-colors border-b last:border-b-0 border-gray-100 group">
                                <div className="flex flex-col">
                                  <div className="text-sm font-bold text-gray-900 group-hover:text-brand-emerald transition-colors flex items-center gap-2">
                                    {q.logo_url && (
                                      <img src={q.logo_url} alt={q.carrier_name} className="h-5 w-auto object-contain rounded-xs mix-blend-multiply" />
                                    )}
                                    <span>{q.carrier_name}</span>
                                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{q.service_level}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-medium mt-1">
                                    Entrega estimada: {q.delivery_days} {q.delivery_days === 1 ? 'día' : 'días'}
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                  <div className="text-sm font-black text-gray-900">{formatMoney(q.cost)}</div>
                                  <button className="text-[10px] font-black text-white bg-brand-emerald px-3 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors shadow-xs cursor-pointer">
                                    Elegir
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación Premium */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white px-6 py-4 rounded-3xl border border-gray-100 shadow-sm mt-6">
          <div className="text-sm text-gray-500 font-medium">
            Mostrando <span className="font-bold text-gray-800">{indexOfFirstOrder + 1}</span>-
            <span className="font-bold text-gray-800">{Math.min(indexOfLastOrder, orders.length)}</span> de{' '}
            <span className="font-bold text-gray-800">{orders.length}</span> ventas
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-brand-emerald hover:text-brand-emerald bg-white disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed text-gray-600 shadow-xs animate-in fade-in"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded-xl font-extrabold text-sm transition-all shadow-xs ${
                  currentPage === page
                    ? 'bg-brand-emerald text-white border border-brand-emerald'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-emerald hover:text-brand-emerald cursor-pointer'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-brand-emerald hover:text-brand-emerald bg-white disabled:opacity-40 disabled:hover:border-gray-250 disabled:hover:text-gray-400 transition-all cursor-pointer disabled:cursor-not-allowed text-gray-600 shadow-xs animate-in fade-in"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
