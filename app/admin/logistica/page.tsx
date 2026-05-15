'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAdminContext } from '@/lib/admin/AdminContext';
import { ContextualNavigation } from '@/components/admin/ContextualNavigation';
import React from 'react';
import { LogisticaRow } from './LogisticaRow';
import { Pagination, usePagination } from '@/components/ui/Pagination';

function AdminLogisticaContent() {
  const { orders: contextOrders, payments, disputes, refreshOrders, refreshPayments } = useAdminContext();
  const searchParams = useSearchParams();
  const showDebug = String(searchParams?.get('debug') || '').trim() === '1';
  const statusFilter = String(searchParams?.get('status') || '').trim() || undefined;
  const initialSearch = String(searchParams?.get('search') || '').trim();

  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);
  const [status, setStatus] = useState(statusFilter);
  const [searchTerm, setSearchTerm] = useState(initialSearch); // Pre-fill from URL
  const [rows, setRows] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, any[]>>({});
  const [weightByOrder, setWeightByOrder] = useState<Record<string, number>>({});
  const [dimsByOrder, setDimsByOrder] = useState<Record<string, { length_cm: number; width_cm: number; height_cm: number }>>({});
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [addressById, setAddressById] = useState<Record<string, any>>({});
  const [disputeByOrderId, setDisputeByOrderId] = useState<Record<string, { id: string; status: string }>>({});
  const [productTypeByOrderId, setProductTypeByOrderId] = useState<Record<string, string>>({});

  const [carrierDraft, setCarrierDraft] = useState<Record<string, string>>({});
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [panelOrderId, setPanelOrderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reloadTimerRef = useRef<any>(null);
  const lastReloadAtRef = useRef<number>(0);
  const uploadedLabelUrlRef = useRef<Record<string, string>>({}); // CRÍTICO: Guardar URLs subidas para verificación

  const scheduleReload = () => {
    // CRÍTICO: No recargar si hay una subida en progreso
    if (isUploading || uploadingOrderId) {
      console.log('[LOGISTICA] Ignorando recarga: subida en progreso', { isUploading, uploadingOrderId });
      return;
    }

    // Debounce + throttle: evita ráfagas si llegan muchos eventos
    const now = Date.now();
    if (now - lastReloadAtRef.current < 1200) return;
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      lastReloadAtRef.current = Date.now();
      void load();
    }, 400);
  };

  // Filtrado cliente-side por término de búsqueda
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase().trim();
    return rows.filter((r) => {
      const oid = String(r?.id || '').toLowerCase();
      const shippingName = String(r?.shipping_full_name || '').toLowerCase();
      const tracking = String(r?.tracking_number || '').toLowerCase();
      const buyerId = String(r?.buyer_id || '').toLowerCase();
      const sellerId = String(r?.seller_id || '').toLowerCase();

      // Buscar en ID, Nombre de envío, Guía, Buyer ID, Seller ID
      return (
        oid.includes(term) ||
        shippingName.includes(term) ||
        tracking.includes(term) ||
        buyerId.includes(term) ||
        sellerId.includes(term)
      );
    });
  }, [rows, searchTerm]);

  // Auto-expand matched order when arriving via ?search= param
  React.useEffect(() => {
    if (initialSearch && filteredRows.length > 0 && filteredRows.length <= 3) {
      setExpandedIds(new Set(filteredRows.map((r: any) => String(r?.id || ''))));
    }
  }, [initialSearch, filteredRows]);

  const load = async (forceReload = false) => {
    // Evitar múltiples cargas simultáneas
    if (isLoading && !forceReload) {
      console.log('[LOGISTICA] Carga ya en progreso, ignorando...');
      return;
    }

    setError(null);
    setDebug(null);
    setIsLoading(true);

    try {
      console.log('[LOGISTICA] Iniciando carga de operaciones...', { statusFilter, forceReload });

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        console.error('[LOGISTICA] No hay token de sesión');
        window.location.href = '/login?returnTo=/admin/logistica';
        return;
      }

      const qs = new URLSearchParams({
        limit: '200', // Aumentar límite para mostrar más operaciones
        t: String(Date.now()),
        _nocache: String(Date.now()), // Forzar sin caché
      });
      if (statusFilter) qs.set('status', statusFilter);

      const url = `/api/admin/logistica/orders/list?${qs.toString()}`;
      console.log('[LOGISTICA] Fetching:', url);

      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store',
        },
        cache: 'no-store',
      });

      const json = await res.json().catch((parseErr) => {
        console.error('[LOGISTICA] Error parseando JSON:', parseErr);
        return { error: 'Error en la respuesta del servidor' };
      });

      console.log('[LOGISTICA] Respuesta recibida:', {
        status: res.status,
        ok: res.ok,
        ordersCount: Array.isArray(json?.orders) ? json.orders.length : 0,
        hasError: !!json?.error,
      });

      if (!res.ok) {
        const errorMsg = json?.error || `No se pudieron cargar operaciones (${res.status}).`;
        console.error('[LOGISTICA] Error del servidor:', { status: res.status, error: errorMsg, json });
        throw new Error(errorMsg);
      }

      const orders = (json?.orders ?? []) as any[];
      console.log(`[LOGISTICA] ✅ ${orders.length} operaciones cargadas exitosamente`);

      // CRÍTICO: Logging para verificar que shipping_label_url está incluido
      const ordersWithLabel = orders.filter((o: any) => o?.shipping_label_url);
      console.log('[LOGISTICA] Órdenes con guía:', {
        total: orders.length,
        withLabel: ordersWithLabel.length,
        sample: ordersWithLabel.slice(0, 3).map((o: any) => ({
          id: o?.id,
          hasUrl: !!o?.shipping_label_url,
          urlPreview: o?.shipping_label_url?.substring(0, 50) + '...',
        })),
      });

      // Actualizar todos los estados de una vez para evitar renders parciales
      setRows(orders);
      setItemsByOrder((json?.itemsByOrder ?? {}) as any);
      setWeightByOrder((json?.weightByOrderId ?? {}) as any);
      setDimsByOrder((json?.dimsByOrderId ?? {}) as any);
      setNameById((json?.nameById ?? {}) as any);
      setAddressById((json?.addressById ?? {}) as any);
      setDisputeByOrderId((json?.disputeByOrderId ?? {}) as any);
      setProductTypeByOrderId((json?.productTypeByOrderId ?? {}) as any);
      setDebug(json?.debug ?? null);

      // Prefill drafts
      const cd: Record<string, string> = {};
      const td: Record<string, string> = {};
      for (const o of orders) {
        const oid = String(o?.id || '');
        if (!oid) continue;
        cd[oid] = String(o?.shipping_carrier || '');
        td[oid] = String(o?.tracking_number || '');
      }
      setCarrierDraft(cd);
      setTrackingDraft(td);

      console.log('[LOGISTICA] Estados actualizados:', {
        ordersCount: orders.length,
        itemsByOrderCount: Object.keys(json?.itemsByOrder ?? {}).length,
        nameByIdCount: Object.keys(json?.nameById ?? {}).length,
      });
    } catch (e: unknown) {
      console.error('[LOGISTICA] Error en load:', e);
      // NO limpiar rows si hay error, mantener los datos anteriores
      // setRows([]); // Comentado para evitar que desaparezcan las operaciones
      setError(e instanceof Error ? e.message : 'No se pudieron cargar operaciones.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        await load();
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Realtime (mejor esfuerzo):
  // - UPDATE/INSERT en `orders` (si RLS/policies lo permiten al admin)
  // - Broadcast "order_updated" (emitido por nuestros endpoints) para no depender de RLS
  useEffect(() => {
    let cancelled = false;

    const ch = supabase
      .channel('admin-logistica')
      .on('broadcast', { event: 'order_updated' }, () => {
        if (cancelled) return;
        scheduleReload();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        if (cancelled) return;
        scheduleReload();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        if (cancelled) return;
        scheduleReload();
      })
      .subscribe();

    // Fallback polling suave (por si realtime no está habilitado o RLS bloquea)
    const poll = setInterval(() => {
      if (cancelled) return;
      void load();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      try {
        supabase.removeChannel(ch);
      } catch {
        // noop
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (d: any) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatMoney = (v: any) => {
    const n = typeof v === 'number' ? v : Number(v ?? 0);
    const nn = Number.isFinite(n) ? n : 0;
    return nn.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  };

  const formatAddress = (addr: any) => {
    if (!addr) return '';
    const street = String(addr?.address_street ?? '').trim();
    const ext = String(addr?.ext_number ?? '').trim();
    const intn = String(addr?.int_number ?? '').trim();
    const neigh = String(addr?.neighborhood ?? '').trim();
    const city = String(addr?.city ?? '').trim();
    const state = String(addr?.state ?? '').trim();
    const zip = String(addr?.zip_code ?? '').trim();

    const line1 = street
      ? `${street}${ext ? ` #${ext}` : ''}${intn ? ` Int ${intn}` : ''}`.trim()
      : '';
    const line2 = [neigh, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join('\n').trim();
    return [line1, line2].filter(Boolean).join('\n').trim();
  };

  const buildRemitenteDestinatarioTxt = (o: any) => {
    const oid = String(o?.id || '');
    const buyerId = String(o?.buyer_id || '');
    const sellerId = String(o?.seller_id || '');
    const buyerName = buyerId ? nameById[buyerId] || `${buyerId.slice(0, 8)}…` : '—';
    const sellerName = sellerId ? nameById[sellerId] || `${sellerId.slice(0, 8)}…` : '—';
    const buyerAddr = (o?.shipping_address ?? {}) as any;
    const sellerAddr = addressById[sellerId] ?? {};
    const buyerProfile = addressById[buyerId] ?? {};
    const buyerAddrFromOrder = formatAddress(buyerAddr);
    const buyerAddrFromProfile = formatAddress(buyerProfile);
    const buyerAddrText = buyerAddrFromOrder || buyerAddrFromProfile;
    const sellerAddrText = formatAddress(sellerAddr);
    const receiverName = String(o?.shipping_full_name || '').trim() || buyerName;
    const receiverPhone = String(o?.shipping_phone || '').trim();
    const sellerPhone = String((sellerAddr as any)?.phone ?? '').trim();
    const sellerRef = String((sellerAddr as any)?.references ?? '').trim();
    const sellerCross = String((sellerAddr as any)?.cross_streets ?? '').trim();
    const buyerRef = String(buyerAddr?.references ?? buyerProfile?.references ?? '').trim();
    const buyerCross = String(buyerAddr?.cross_streets ?? buyerProfile?.cross_streets ?? '').trim();

    const rem: string[] = [
      'REMITENTE (Vendedor)',
      '—'.repeat(40),
      `Nombre: ${sellerName}`,
      ...(sellerPhone ? [`Tel: ${sellerPhone}`] : []),
      sellerAddrText ? `Dirección:\n${sellerAddrText}` : 'Dirección: (no disponible)',
      ...(sellerRef ? [`Referencias: ${sellerRef}`] : []),
      ...(sellerCross ? [`Entre calles: ${sellerCross}`] : []),
    ];
    const des: string[] = [
      'DESTINATARIO (Comprador)',
      '—'.repeat(40),
      `Nombre: ${receiverName}`,
      ...(receiverPhone ? [`Tel: ${receiverPhone}`] : []),
      buyerAddrText ? `Dirección:\n${buyerAddrText}` : 'Dirección: (no disponible)',
      ...(buyerRef ? [`Referencias: ${buyerRef}`] : []),
      ...(buyerCross ? [`Entre calles: ${buyerCross}`] : []),
    ];
    const footer = ['', `Operación: ${oid}`, `Fecha: ${fmt(o?.created_at)}`];
    return [...rem, '', ...des, ...footer].join('\n');
  };

  const downloadRemitenteDestinatario = (o: any) => {
    const txt = buildRemitenteDestinatarioTxt(o);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remitente-destinatario-${String(o?.id || 'orden').slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadLabel = async (orderId: string, file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadingOrderId(orderId); // CRÍTICO: Marcar que esta orden está siendo subida

    // CRÍTICO: Guardar el estado anterior para rollback si falla
    const previousRows = rows;

    try {
      console.log('[LOGISTICA] Iniciando subida de guía:', { orderId, fileName: file.name, fileSize: file.size, fileType: file.type });

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        console.error('[LOGISTICA] No hay token de sesión');
        window.location.href = '/login?returnTo=/admin/logistica';
        return;
      }

      // Validar archivo
      if (!file || file.size === 0 || file.size > 15 * 1024 * 1024) {
        throw new Error('Archivo inválido.');
      }
      if (file.type && !file.type.includes('pdf') && !file.type.includes('application/pdf')) {
        console.warn('[LOGISTICA] Tipo de archivo no es PDF:', file.type);
      }

      const fd = new FormData();
      fd.append('orderId', orderId);
      fd.append('file', file);

      console.log('[LOGISTICA] Enviando request a API...');
      // Usar endpoint v2 (nueva arquitectura)
      const res = await fetch('/api/admin/logistica/label/upload-v2', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd
      });

      console.log('[LOGISTICA] Respuesta recibida:', { status: res.status, ok: res.ok });

      const json = await res.json().catch((parseErr) => {
        console.error('[LOGISTICA] Error parseando JSON:', parseErr);
        return { error: 'Error en la respuesta del servidor' };
      });

      console.log('[LOGISTICA] JSON respuesta:', json);

      if (!res.ok || !json?.ok || !json?.url) {
        const errorMsg = json?.error || `No se pudo subir la guía (${res.status}).`;
        console.error('[LOGISTICA] Error del servidor:', { status: res.status, error: errorMsg, json });
        throw new Error(errorMsg);
      }

      console.log('[LOGISTICA] ✅ Guía subida exitosamente:', { url: json.url, orderId });

      // CRÍTICO: Guardar la URL en el ref para verificación posterior
      uploadedLabelUrlRef.current[orderId] = json.url;

      // CRÍTICO: Actualizar estado local con los datos del servidor (optimistic update mejorado)
      setRows((prev) =>
        prev.map((o) => {
          const oid = String(o?.id || '');
          if (oid === orderId) {
            console.log('[LOGISTICA] Actualizando orden localmente:', oid, { url: json.url });
            return {
              ...o,
              shipping_label_url: json.url, // CRÍTICO: Usar la URL del servidor directamente
              shipping_label_uploaded_at: new Date().toISOString(),
              shipping_label_uploaded_by: undefined, // Se actualizará en la recarga
              label_downloaded_at: null, // Resetear descarga al re-subir
            };
          }
          return o;
        })
      );

      // CRÍTICO: Limpiar el input file para permitir re-subir el mismo archivo
      const fileInput = document.getElementById(`label_${orderId}`) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
        console.log('[LOGISTICA] Input file limpiado');
      }

      // CRÍTICO: Recargar desde BD después de un delay para sincronizar
      // Usar un delay suficiente para que la BD se actualice, pero no tan largo que el usuario note el delay
      setTimeout(async () => {
        console.log('[LOGISTICA] Verificando que la guía se guardó en BD...', { orderId, expectedUrl: json.url });

        // CRÍTICO: Recargar siempre para sincronizar con BD y obtener shipping_label_uploaded_by
        // El scheduleReload está protegido por uploadingOrderId, así que no interferirá
        await load(true);

        // CRÍTICO: Verificar después de recargar que la URL persiste
        // Usar un pequeño delay adicional para asegurar que la recarga completó
        setTimeout(() => {
          // Verificar usando el ref que guardamos
          const expectedUrl = uploadedLabelUrlRef.current[orderId];
          if (expectedUrl) {
            // Verificar en el estado actual (usando una función de callback)
            setRows((currentRows) => {
              const order = currentRows.find((o) => String(o?.id || '') === orderId);
              if (order) {
                if (String(order.shipping_label_url || '').trim() === expectedUrl) {
                  console.log('[LOGISTICA] ✅ Verificación exitosa: La URL persiste en el estado después de recargar');
                } else {
                  console.warn('[LOGISTICA] ⚠️ ADVERTENCIA: La URL no coincide después de recargar', {
                    expected: expectedUrl,
                    actual: order.shipping_label_url,
                  });
                  // Restaurar la URL esperada si se perdió
                  return currentRows.map((o) => {
                    if (String(o?.id || '') === orderId && String(o.shipping_label_url || '').trim() !== expectedUrl) {
                      console.log('[LOGISTICA] Restaurando URL en el estado:', expectedUrl);
                      return {
                        ...o,
                        shipping_label_url: expectedUrl,
                      };
                    }
                    return o;
                  });
                }
              } else {
                console.warn('[LOGISTICA] ⚠️ ADVERTENCIA: Orden no encontrada después de recargar');
              }
              return currentRows;
            });
          }

          // CRÍTICO: Limpiar el flag y el ref después de verificar
          setUploadingOrderId(null);
          delete uploadedLabelUrlRef.current[orderId];
        }, 300); // Pequeño delay adicional para verificación
      }, 2000); // Aumentar delay a 2 segundos para dar tiempo suficiente a que se guarde en BD

    } catch (e: unknown) {
      console.error('[LOGISTICA] Error en uploadLabel:', e);
      setError(e instanceof Error ? e.message : 'No se pudo subir la guía.');

      // CRÍTICO: Rollback del estado si falla
      setRows(previousRows);
      setUploadingOrderId(null);

      // CRÍTICO: Limpiar el ref si falla
      delete uploadedLabelUrlRef.current[orderId];
    } finally {
      setIsUploading(false);
    }
  };

  const updateOrder = async (orderId: string, action?: 'mark_shipped' | 'mark_delivered' | 'clear_tracking') => {
    setError(null);
    setIsSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/logistica';
        return;
      }
      const res = await fetch('/api/admin/logistica/order/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId,
          shipping_carrier: carrierDraft[orderId] ?? '',
          tracking_number: trackingDraft[orderId] ?? '',
          action,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar la orden.');
      // Forzar recarga inmediata después de actualizar
      await load(true);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la orden.');
    } finally {
      setIsSaving(false);
    }
  };

  const { paginatedItems: paginatedRows, paginationProps, setCurrentPage } = usePagination(filteredRows, 50);

  // Reset page on search change
  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, setCurrentPage]);

  const countLabel = useMemo(() => {
    if (isLoading) return 'Cargando…';
    const from = (paginationProps.currentPage - 1) * 50 + 1;
    const to = Math.min(paginationProps.currentPage * 50, filteredRows.length);
    return `${from}–${to} de ${filteredRows.length} operaciones`;
  }, [isLoading, filteredRows.length, paginationProps.currentPage]);

  const handleNotifyDelay = async (orderId: string) => {
    if (!confirm('¿Enviar notificación de retraso al vendedor?')) return;
    try {
      const res = await fetch('/api/admin/notify-delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, type: 'shipping_delay' })
      });
      if (res.ok) {
        alert('Notificación enviada');
      } else {
        const err = await res.json();
        alert(`Error al enviar: ${err.error || 'Desconocido'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  };

  const shipmentBadge = (o: any) => {
    const oid = String(o?.id || '').trim();
    const isDigitalProduct = productTypeByOrderId[oid] === 'digital';
    const d = oid ? disputeByOrderId[oid] : null;
    const disputeStatus = String(d?.status || '').trim().toLowerCase();
    const hasDispute = Boolean(d?.id) && disputeStatus !== 'resolved' && disputeStatus !== 'closed';
    if (hasDispute) {
      return <span className="inline-flex items-center rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700 ring-1 ring-red-200">Disputa</span>;
    }

    const st = String(o?.status || '').trim().toLowerCase();
    const deliveredAt = String(o?.delivered_at || '').trim();
    const shippedAt = String(o?.shipped_at || '').trim();
    const tracking = String(o?.tracking_number || '').trim();
    const paidToSellerAt = String(o?.paid_to_seller_at || '').trim();

    if (st === 'delivered' || Boolean(deliveredAt) || Boolean(paidToSellerAt)) {
      return <span className="inline-flex items-center rounded-xl bg-green-50 px-3 py-2 text-xs font-extrabold text-green-800 ring-1 ring-green-200">Entregado</span>;
    }
    if (st === 'shipped' || Boolean(shippedAt) || Boolean(tracking)) {
      if (isDigitalProduct) {
        return <span className="inline-flex items-center rounded-xl bg-indigo-50 px-3 py-2 text-xs font-extrabold text-indigo-800 ring-1 ring-indigo-200">📱 Entregado digitalmente</span>;
      }
      return <span className="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-800 ring-1 ring-sky-200">En camino</span>;
    }
    if (st === 'paid') {
      if (isDigitalProduct) {
        return <span className="inline-flex items-center rounded-xl bg-indigo-50 px-3 py-2 text-xs font-extrabold text-indigo-800 ring-1 ring-indigo-200">📱 Esperando entrega digital</span>;
      }
      // Si tiene tracking pero status sigue en paid, mostramos "En camino"
      if (Boolean(tracking)) {
        return <span className="inline-flex items-center rounded-xl bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-800 ring-1 ring-sky-200">En camino</span>;
      }
      return <span className="inline-flex items-center rounded-xl bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-900 ring-1 ring-amber-200">Por enviar</span>;
    }
    if (st === 'pending_payment') {
      return <span className="inline-flex items-center rounded-xl bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700 ring-1 ring-black/10">Pendiente de pago</span>;
    }
    return <span className="inline-flex items-center rounded-xl bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-700 ring-1 ring-black/10">{String(o?.status || '—')}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-8 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-white/20 backdrop-blur-sm p-3">
              <span className="text-3xl">📦</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-white">Logística</h1>
                {statusFilter ? (
                  <>
                    <span className="rounded-lg bg-white/30 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white">
                      Filtro: {statusFilter === 'paid' ? 'solo por enviar (paid)' : statusFilter}
                    </span>
                    <Link
                      href="/admin/logistica"
                      className="rounded-lg bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 transition"
                    >
                      ✕ Quitar
                    </Link>
                  </>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-white/90">
                Gestión de guías (PDF), recordatorios, estatus de envío y direcciones para generar etiquetas.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent"></div>
      </div>

      {/* Contenido principal */}
      <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar operación, guía, nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 rounded-xl border border-gray-300 px-4 py-2.5 pl-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
            <Link
              href="/admin/pagos"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-purple-600 hover:to-pink-700 transition-all"
            >
              <span>💳</span>
              Pagos
            </Link>
            <button
              type="button"
              onClick={() => {
                console.log('[LOGISTICA] Botón Actualizar clickeado');
                void load(true);
              }}
              disabled={isLoading || isUploading || isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-gray-700 hover:to-gray-800 transition-all disabled:opacity-60"
            >
              <span>🔄</span>
              {isLoading ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border-l-4 border-red-500 bg-red-50/80 backdrop-blur-sm px-5 py-4 shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <div className="font-bold text-red-900">Error</div>
                <div className="mt-1 text-sm text-red-800">{error}</div>
              </div>
            </div>
          </div>
        ) : null}
        {showDebug && debug ? (
          <details className="mt-4 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-xs text-gray-700">
            <summary className="cursor-pointer text-xs font-semibold text-gray-900">Debug (Logística)</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(debug, null, 2)}</pre>
          </details>
        ) : null}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2 rounded-lg">
            {countLabel}
          </div>
        </div>

        {isBooting ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-sm font-semibold text-gray-600">Cargando operaciones...</p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700" style={{ width: '40px' }}></th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Operación</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Envío</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Comprador → Vendedor</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                        <p className="mt-3 text-sm font-semibold text-gray-600">Cargando operaciones...</p>
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        {searchTerm ? (
                          <>
                            <div className="text-5xl mb-4">🔍</div>
                            <div className="text-lg font-bold text-gray-900 mb-2">No se encontraron resultados</div>
                            <div className="mt-2 text-sm text-gray-600">
                              No hay operaciones que coincidan con "{searchTerm}"
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-5xl mb-4">📦</div>
                            <div className="text-lg font-bold text-gray-900 mb-2">No hay operaciones para logística</div>
                            <div className="mt-2 text-xs text-gray-600">
                              Para que aparezcan aquí:
                              <div className="mt-2 space-y-1">
                                <div>- Realiza una compra (se crean filas en la tabla <span className="font-semibold">orders</span>).</div>
                                <div>
                                  - Si fue pago offline (transferencia/depósito/OXXO): marca la operación como pagada en{' '}
                                  <Link href="/admin/pagos" className="font-semibold text-brand-emerald hover:underline">
                                    Admin → Pagos
                                  </Link>
                                  .
                                </div>
                                <div>- Luego vuelve aquí y presiona <span className="font-semibold">Actualizar</span>.</div>
                              </div>
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                              Si aún así no aparecen y ya tienes órdenes, ejecuta en Supabase:{' '}
                              <span className="font-mono">{`NOTIFY pgrst, 'reload schema';`}</span>
                            </div>
                          </>
                        )}
                        {debug ? (
                          <div className="mt-4 text-left">
                            <div className="text-xs font-semibold text-gray-900">Diagnóstico</div>
                            <div className="mt-1 text-xs text-gray-600">
                              <span className="font-semibold">ordersCount</span>: {String((debug as any)?.ordersCount ?? '—')}
                            </div>
                            {(debug as any)?.missingLogisticsColumns ? (
                              <div className="mt-1 text-xs text-amber-700">
                                Faltan columnas de logística en tu tabla <span className="font-semibold">orders</span>.
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((o) => {
                      const oid = String(o?.id || '');
                      return (
                        <LogisticaRow
                          key={oid}
                          o={o}
                          oid={oid}
                          isExpanded={expandedIds.has(oid)}
                          onToggle={toggleExpand}
                          nameById={nameById}
                          addressById={addressById}
                          itemsByOrder={itemsByOrder}
                          weightByOrder={weightByOrder}
                          dimsByOrder={dimsByOrder}
                          productTypeByOrderId={productTypeByOrderId}
                          disputeByOrderId={disputeByOrderId}
                          fmt={fmt}
                          formatMoney={formatMoney}
                          formatAddress={formatAddress}
                          shipmentBadge={shipmentBadge}
                          handleNotifyDelay={handleNotifyDelay}
                          uploadLabel={uploadLabel}
                          setPanelOrderId={setPanelOrderId}
                          isUploading={isUploading}
                          uploadingOrderId={uploadingOrderId}
                          payments={payments}
                          disputes={disputes}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...paginationProps} />
          </div>
        )}

        {panelOrderId ? (() => {
          const o = rows.find((r) => String(r?.id || '') === panelOrderId);
          if (!o) return null;
          const oid = String(o?.id || '');
          const buyerId = String(o?.buyer_id || '');
          const sellerId = String(o?.seller_id || '');
          const buyerName = buyerId ? nameById[buyerId] || `${buyerId.slice(0, 8)}…` : '—';
          const sellerName = sellerId ? nameById[sellerId] || `${sellerId.slice(0, 8)}…` : '—';
          const buyerAddr = (o?.shipping_address ?? {}) as any;
          const sellerAddr = addressById[sellerId] ?? {};
          const buyerProfile = addressById[buyerId] ?? {};
          const buyerAddrFromOrder = formatAddress(buyerAddr);
          const buyerAddrFromProfile = formatAddress(buyerProfile);
          const buyerAddrText = buyerAddrFromOrder || buyerAddrFromProfile;
          const sellerAddrText = formatAddress(sellerAddr);
          const receiverName = String(o?.shipping_full_name || '').trim() || buyerName;
          const receiverPhone = String(o?.shipping_phone || '').trim();
          const sellerPhone = String((sellerAddr as any)?.phone ?? '').trim();
          const sellerRef = String((sellerAddr as any)?.references ?? '').trim();
          const sellerCross = String((sellerAddr as any)?.cross_streets ?? '').trim();
          const buyerRef = String(buyerAddr?.references ?? buyerProfile?.references ?? '').trim();
          const buyerCross = String(buyerAddr?.cross_streets ?? buyerProfile?.cross_streets ?? '').trim();

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="panel-remitente-destinatario-title"
              onClick={() => setPanelOrderId(null)}
            >
              <div
                className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
                  <h2 id="panel-remitente-destinatario-title" className="text-lg font-bold text-gray-900">
                    Remitente y Destinatario · {oid.slice(0, 8)}…
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPanelOrderId(null)}
                    className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Cerrar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
                  <div className="space-y-6">
                    <section className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Remitente (Vendedor)</h3>
                      <div className="mt-2 text-sm text-gray-900">
                        <div className="font-semibold">{sellerName}</div>
                        {sellerPhone ? <div className="mt-1 text-gray-700">Tel: {sellerPhone}</div> : null}
                        <div className="mt-2 whitespace-pre-wrap text-gray-700">{sellerAddrText || 'Dirección no disponible.'}</div>
                        {sellerRef ? <div className="mt-2 text-gray-700"><span className="font-medium text-gray-800">Referencias:</span> {sellerRef}</div> : null}
                        {sellerCross ? <div className="mt-1 text-gray-700"><span className="font-medium text-gray-800">Entre calles:</span> {sellerCross}</div> : null}
                      </div>
                    </section>
                    <section className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Destinatario (Comprador)</h3>
                      <div className="mt-2 text-sm text-gray-900">
                        <div className="font-semibold">{receiverName}</div>
                        {receiverPhone ? <div className="mt-1 text-gray-700">Tel: {receiverPhone}</div> : null}
                        <div className="mt-2 whitespace-pre-wrap text-gray-700">{buyerAddrText || 'Dirección no disponible.'}</div>
                        {buyerRef ? <div className="mt-2 text-gray-700"><span className="font-medium text-gray-800">Referencias:</span> {buyerRef}</div> : null}
                        {buyerCross ? <div className="mt-1 text-gray-700"><span className="font-medium text-gray-800">Entre calles:</span> {buyerCross}</div> : null}
                      </div>
                    </section>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-black/5 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => downloadRemitenteDestinatario(o)}
                    className="rounded-xl bg-brand-emerald px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                  >
                    Descargar .txt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelOrderId(null)}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 ring-1 ring-black/10 hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })() : null}
      </div>
    </div>
  );
}

export default function AdminLogisticaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-emerald mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <AdminLogisticaContent />
    </Suspense>
  );
}

