'use client';

import React from 'react';
import Link from 'next/link';
import { ShippingBadge } from '@/components/ui/ShippingBadge';

// ── Types ──
export interface LogisticaRowProps {
    o: any;
    oid: string;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    // lookups
    nameById: Record<string, string>;
    addressById: Record<string, any>;
    itemsByOrder: Record<string, any[]>;
    weightByOrder: Record<string, number>;
    dimsByOrder: Record<string, { length_cm: number; width_cm: number; height_cm: number }>;
    productTypeByOrderId: Record<string, string>;
    disputeByOrderId: Record<string, { id: string; status: string }>;
    // helpers
    fmt: (d: any) => string;
    formatMoney: (v: any) => string;
    formatAddress: (addr: any) => string;
    shipmentBadge: (o: any) => React.ReactNode;
    // actions
    handleNotifyDelay: (orderId: string) => void;
    uploadLabel: (orderId: string, file: File) => Promise<void>;
    setPanelOrderId: (id: string) => void;
    onUpdateOrder?: (orderId: string, action?: 'mark_shipped' | 'mark_delivered' | 'clear_tracking') => void;
    isSaving?: boolean;
    // upload state
    isUploading: boolean;
    uploadingOrderId: string | null;
    // context data
    payments: any[];
    disputes: any[];
}

export function LogisticaRow({
    o, oid, isExpanded, onToggle,
    nameById, addressById, itemsByOrder, weightByOrder, dimsByOrder,
    productTypeByOrderId, disputeByOrderId,
    fmt, formatMoney, formatAddress, shipmentBadge,
    handleNotifyDelay, uploadLabel, setPanelOrderId,
    onUpdateOrder, isSaving = false,
    isUploading, uploadingOrderId,
    payments, disputes,
}: LogisticaRowProps) {
    const st = String(o?.status || '').trim().toLowerCase();
    const buyerId = String(o?.buyer_id || '');
    const sellerId = String(o?.seller_id || '');
    const buyerName = buyerId ? nameById[buyerId] || `${buyerId.slice(0, 6)}…` : '—';
    const sellerName = sellerId ? nameById[sellerId] || `${sellerId.slice(0, 6)}…` : '—';
    const buyerAddr = (o?.shipping_address ?? {}) as any;
    const sellerAddr = addressById[sellerId] ?? {};

    const buyerAddrFromOrder = formatAddress(buyerAddr);
    const buyerAddrFromProfile = formatAddress(addressById[buyerId] ?? {});
    const buyerAddrText = buyerAddrFromOrder || buyerAddrFromProfile;
    const buyerAddrSource = buyerAddrFromOrder ? 'orden' : buyerAddrFromProfile ? 'perfil' : '';
    const sellerAddrText = formatAddress(sellerAddr);

    const labelUrl = String(o?.shipping_label_url || '').trim();
    const downloadedAtRaw = String(o?.label_downloaded_at || '').trim();
    const isDownloaded = Boolean(downloadedAtRaw);
    const fileInputId = `label_${oid}`;
    const hasLabel = Boolean(labelUrl);
    const labelStatus = hasLabel ? (isDownloaded ? 'downloaded' : 'uploaded') : 'pending';
    const tracking = String(o?.tracking_number || '').trim();
    const carrier = String(o?.shipping_carrier || '').trim();
    const shippedAt = String(o?.shipped_at || '').trim();
    const deliveredAt = String(o?.delivered_at || '').trim();

    const items = itemsByOrder[oid] || [];
    const firstItem = items[0];
    const productTitle = firstItem?.title || 'Sin datos';
    const productImage = firstItem?.image || '';

    const fee = Number((o as any)?.shipping_fee || 0);
    const subsidy = Number((o as any)?.shipping_subsidy || 0);
    const totalCost = Math.max(0, fee + subsidy);
    const carrierVal = carrier.toLowerCase();
    const isPickupRow = carrierVal === 'pickup' || o?.shipping_option_id === 'pickup';
    const isDigitalProduct = productTypeByOrderId[oid] === 'digital';

    return (
        <React.Fragment>
            {/* ── COMPACT SUMMARY ROW ── */}
            <tr
                className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/60' : 'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50'}`}
                onClick={() => onToggle(oid)}
            >
                {/* Chevron */}
                <td className="px-3 py-3 text-center">
                    <span className={`inline-block transition-transform duration-200 text-gray-400 text-sm ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                </td>
                {/* Operación */}
                <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                        {oid.slice(0, 8)}…
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(oid);
                                const el = document.getElementById(`oid-${oid}`);
                                if (el) { const orig = el.innerText; el.innerText = 'Copiado!'; setTimeout(() => { el.innerText = orig; }, 1000); }
                            }}
                            className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                            title="Copiar ID completo"
                        >
                            <span id={`oid-${oid}`}>📋</span>
                        </button>
                        {(o as any)?.payment_method === 'mercadopago' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700 ring-1 ring-sky-200">MP</span>
                        )}
                    </div>
                    <div className="text-[11px] text-gray-500">{fmt(o?.created_at)} · {formatMoney(o?.total)}</div>
                </td>
                {/* Producto */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        {productImage && (
                            <img src={String(productImage)} alt={productTitle} className="h-8 w-8 flex-none rounded object-cover ring-1 ring-black/10" loading="lazy" referrerPolicy="no-referrer" />
                        )}
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate max-w-[200px]">
                                {firstItem && <span className="font-semibold">{firstItem.quantity}x</span>} {productTitle}
                            </div>
                            {items.length > 1 && <div className="text-[10px] text-gray-400">+{items.length - 1} más</div>}
                            {weightByOrder[oid] ? <div className="text-[10px] text-gray-500">{weightByOrder[oid].toFixed(2)} kg</div> : null}
                        </div>
                    </div>
                </td>
                {/* Envío badge */}
                <td className="px-4 py-3">
                    {(() => {
                        const hasGoVendyFree = items.some((it: any) => Boolean(it?.is_gopocket_free));
                        const isAuction = items.some((it: any) => String(it?.sale_type || '') === 'auction');
                        return (
                            <ShippingBadge
                                shippingOptionId={o?.shipping_option_id}
                                shippingCarrier={o?.shipping_carrier}
                                shippingBySeller={o?.shipping_by_seller}
                                shippingFee={fee}
                                isDigital={isDigitalProduct}
                                isGoVendyFree={hasGoVendyFree}
                                isAuction={isAuction}
                                showOrderSource={true}
                            />
                        );
                    })()}
                </td>
                {/* Comprador → Vendedor */}
                <td className="px-4 py-3">
                    <div className="text-xs">
                        <span className="font-semibold text-gray-900">{buyerName}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="font-semibold text-gray-900">{sellerName}</span>
                    </div>
                </td>
                {/* Estado */}
                <td className="px-4 py-3">
                    {shipmentBadge(o)}
                </td>
            </tr>

            {/* ── EXPANDABLE DETAIL ── */}
            {isExpanded && (
                <tr className="bg-gradient-to-b from-blue-50/40 to-white">
                    <td colSpan={6} className="px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* SEC 1: Origen / Destino */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider border-b pb-1">📍 Origen / Destino</h4>
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Origen (Vendedor)</div>
                                    <div className="text-sm font-semibold text-gray-900">{sellerName}</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">{sellerId ? sellerId.slice(0, 8) + '…' : '—'}</div>
                                    <div className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{sellerAddrText || 'Dirección del vendedor no disponible en profiles.'}</div>
                                </div>
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Destino (Comprador)</div>
                                    <div className="text-sm font-semibold text-gray-900">{buyerName}</div>
                                    {String(o?.shipping_full_name || '').trim() ? (
                                        <div className="text-xs text-gray-700 mt-0.5">Recibe: {String(o.shipping_full_name)}</div>
                                    ) : null}
                                    {String(o?.shipping_phone || '').trim() ? <div className="text-xs text-gray-700 mt-0.5">Tel: {String(o.shipping_phone)}</div> : null}
                                    <div className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{buyerAddrText || 'Dirección no disponible.'}</div>
                                    {buyerAddrSource ? (
                                        <div className="text-[11px] text-gray-500 mt-0.5">Fuente: <span className="font-semibold text-gray-700">{buyerAddrSource}</span></div>
                                    ) : null}
                                </div>
                            </div>

                            {/* SEC 2: Productos & Envío */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider border-b pb-1">📦 Productos & Envío</h4>
                                {/* Products */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Productos</div>
                                    <div className="flex flex-col gap-1.5">
                                        {items.map((it: any, idx: number) => (
                                            <div key={idx} className="text-xs text-gray-700 flex items-center gap-2">
                                                {it?.image ? <img src={String(it.image)} alt={String(it.title || 'Producto')} className="h-8 w-8 rounded object-cover ring-1 ring-black/10" loading="lazy" referrerPolicy="no-referrer" /> : null}
                                                <span><span className="font-semibold">{it.quantity}x</span> {it.title}</span>
                                            </div>
                                        ))}
                                        {items.length === 0 && <span className="text-xs text-gray-400 italic">Sin datos</span>}
                                    </div>
                                </div>
                                {/* Weight + Dimensions */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Peso & Dimensiones</div>
                                    <div className="text-sm font-bold text-gray-900">{weightByOrder[oid] ? `${weightByOrder[oid].toFixed(2)} kg` : '—'}</div>
                                    {dimsByOrder[oid] && (dimsByOrder[oid].length_cm || dimsByOrder[oid].width_cm || dimsByOrder[oid].height_cm) ? (
                                        <div className="text-[11px] text-gray-600 mt-1">
                                            📦 {`${Number(dimsByOrder[oid].length_cm || 0)}×${Number(dimsByOrder[oid].width_cm || 0)}×${Number(dimsByOrder[oid].height_cm || 0)} cm`}
                                        </div>
                                    ) : null}
                                </div>
                                {/* Shipping detail */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Envío</div>
                                    {(() => {
                                        const isGoVendyCarrier = ['gopocket', 'estafeta', 'fedex', 'tuenvio', 'dhl', 'ups'].includes(carrierVal);
                                        const isSellerRow = Boolean(o?.shipping_by_seller) || (carrierVal && carrierVal !== 'pickup' && !o?.shipping_option_id && !isGoVendyCarrier);
                                        const isFreeRow = fee === 0 && subsidy > 0;
                                        if (isDigitalProduct) {
                                            return (
                                                <div className="space-y-1">
                                                    <div className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">💎 Producto Digital</div>
                                                    <div className="text-[11px] text-gray-500">$0.00 · Entrega digital</div>
                                                </div>
                                            );
                                        }
                                        if (isPickupRow) {
                                            return (
                                                <div className="space-y-1">
                                                    <div className="inline-flex items-center rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-bold text-purple-700 ring-1 ring-purple-200">🤝 Personal</div>
                                                    <div className="text-[11px] text-gray-500">$0.00</div>
                                                </div>
                                            );
                                        }
                                        if (isSellerRow) {
                                            const isSellerFreeShipping = fee === 0;
                                            return (
                                                <div className="space-y-1">
                                                    <div className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">📦 Vendedor</div>
                                                    {isSellerFreeShipping ? (
                                                        <>
                                                            <div className="text-xs font-bold text-green-600">Envío Gratis</div>
                                                            {carrier ? <div className="text-[11px] text-gray-500">{carrier}</div> : null}
                                                            <div className="text-[11px] text-green-600 font-semibold">Vendedor cubre el envío</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="text-xs font-semibold text-gray-900">{formatMoney(fee)}</div>
                                                            {carrier ? <div className="text-[11px] text-gray-500">{carrier}</div> : null}
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div className="space-y-1">
                                                <div className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-200">🚚 GoVendy</div>
                                                <div className="text-xs text-gray-900">
                                                    <div>Total: <span className="font-bold">{formatMoney(totalCost)}</span></div>
                                                    <div className="text-[11px] text-gray-600">Comprador: <span className="font-semibold">{formatMoney(fee)}</span></div>
                                                    {subsidy > 0 ? <div className="text-[11px] text-orange-600">Vendedor paga: <span className="font-semibold">{formatMoney(subsidy)}</span></div> : null}
                                                </div>
                                                {fee === 0 && subsidy > 0 ? <div className="text-[11px] text-green-600 font-semibold">Envío gratis (vendedor cubre)</div> : null}
                                            </div>
                                        );
                                    })()}
                                </div>
                                {/* Payment status */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Pago</div>
                                    <div className="text-sm font-bold text-gray-900 mb-1">Total: {formatMoney(o?.total)}</div>
                                    {(() => {
                                        const s = String(o?.status || '').toLowerCase();
                                        const isPaid = s === 'paid' || s === 'shipped' || s === 'delivered' || s === 'completed' || s === 'received';
                                        const isPending = s === 'pending_payment' || s === 'pending';
                                        const isCancelled = s === 'cancelled' || s === 'canceled' || s === 'rejected';
                                        if (isPaid) return <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">✅ Aprobado</span>;
                                        if (isCancelled) return <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">❌ Cancelado</span>;
                                        if (isPending) return <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">⏳ Pendiente</span>;
                                        return null;
                                    })()}
                                </div>
                            </div>

                            {/* SEC 3: Rastreo & Guía */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider border-b pb-1">🚚 Rastreo & Guía</h4>
                                {/* Tracking */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Rastreo</div>
                                    <RastreoContent o={o} oid={oid} items={items} tracking={tracking} carrier={carrier} shippedAt={shippedAt} deliveredAt={deliveredAt} fee={fee} subsidy={subsidy} isPickupRow={isPickupRow} isDigitalProduct={isDigitalProduct} fmt={fmt} formatMoney={formatMoney} />
                                </div>
                                {/* Guía PDF */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Guía (PDF)</div>
                                    <GuiaPdfContent o={o} labelUrl={labelUrl} hasLabel={hasLabel} isDownloaded={isDownloaded} fmt={fmt} />
                                </div>
                                {/* Upload */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Upload Guía</div>
                                    <UploadContent
                                        o={o} oid={oid} fileInputId={fileInputId}
                                        labelStatus={labelStatus} isDownloaded={isDownloaded}
                                        isUploading={isUploading} uploadingOrderId={uploadingOrderId}
                                        uploadLabel={uploadLabel}
                                        isDigitalProduct={isDigitalProduct}
                                        isPickupRow={isPickupRow}
                                        itemsByOrder={itemsByOrder}
                                        fmt={fmt}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── BOTTOM: Actions ── */}
                        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-3">
                            {/* Delivery proof links */}
                            {(o?.shipping_option_id === 'pickup' || o?.shipping_carrier === 'pickup') && o.delivery_proof_url && (
                                <div className="flex items-center gap-2">
                                    {o.delivery_proof_url.split(',').map((url: string, idx: number) => {
                                        const total = o.delivery_proof_url!.split(',').length;
                                        const lb = total > 1 ? (idx === 0 ? '📄 Constancia' : '🪪 INE') : 'Ver evidencia';
                                        return <a key={idx} href={url.trim()} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-emerald hover:underline">{lb}</a>;
                                    })}
                                </div>
                            )}
                            {/* Disputes & Payments */}
                            {(() => {
                                const relatedPayment = payments.find((p: any) => p.order_ids?.includes(oid));
                                const relatedDispute = disputes.find((d: any) => d.order_id === oid);
                                return (
                                    <>
                                        {relatedPayment && (
                                            <Link href={`/admin/operations?paymentId=${relatedPayment.id}`} className="inline-flex rounded-md bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-800 shadow-sm ring-1 ring-purple-200 hover:bg-purple-100" title={`Pago: ${relatedPayment.reference_code || relatedPayment.id.slice(0, 8)} - ${relatedPayment.status}`}>
                                                💰 {relatedPayment.status === 'pending' ? 'Pago pendiente' : 'Pago'}
                                            </Link>
                                        )}
                                        {relatedDispute && (
                                            <Link href={`/admin/operations?disputeId=${relatedDispute.id}`} className="inline-flex rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-800 shadow-sm ring-1 ring-red-200 hover:bg-red-100" title={`Disputa: ${relatedDispute.status}`}>
                                                ⚖️ Disputa
                                            </Link>
                                        )}
                                    </>
                                );
                            })()}
                            {String(disputeByOrderId[oid]?.id || '').trim() ? (
                                <Link href={`/admin/disputas/${String(disputeByOrderId[oid]?.id || '').trim()}`} className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
                                    Ver disputa →
                                </Link>
                            ) : null}
                            <Link href={`/admin/chat/${oid}`} className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">Ver chat</Link>
                            <button onClick={() => handleNotifyDelay(oid)} className="inline-flex rounded-xl bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800 shadow-sm ring-1 ring-yellow-200 hover:bg-yellow-100" title="Enviar notificación flotante de retraso">🔔 Notificar</button>
                            {onUpdateOrder && (st === 'paid' || st === 'pending_payment') && !shippedAt && (
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={(e) => { e.stopPropagation(); onUpdateOrder(oid, 'mark_shipped'); }}
                                    className="inline-flex rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                                >
                                    Marcar enviado
                                </button>
                            )}
                            {onUpdateOrder && (st === 'shipped' || st === 'paid') && !deliveredAt && (
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={(e) => { e.stopPropagation(); onUpdateOrder(oid, 'mark_delivered'); }}
                                    className="inline-flex rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                                >
                                    Marcar entregado
                                </button>
                            )}
                            {onUpdateOrder && tracking && (st === 'shipped' || st === 'paid') && (
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={(e) => { e.stopPropagation(); if (confirm('¿Limpiar rastreo de esta orden?')) onUpdateOrder(oid, 'clear_tracking'); }}
                                    className="inline-flex rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-200 disabled:opacity-50"
                                >
                                    Limpiar rastreo
                                </button>
                            )}
                            <Link href={`/admin/operations?orderId=${oid}`} className="inline-flex rounded-xl bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800 shadow-sm ring-1 ring-purple-200 hover:bg-purple-100">Ver completo</Link>
                            <button type="button" onClick={() => setPanelOrderId(oid)} className="inline-flex rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800 ring-1 ring-black/5 hover:bg-gray-200">Remitente / Destinatario</button>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}

// ── Sub-components to keep main component readable ──

function RastreoContent({ o, oid, items, tracking, carrier, shippedAt, deliveredAt, fee, subsidy, isPickupRow, isDigitalProduct, fmt, formatMoney }: any) {
    const labelUrl2 = String(o?.shipping_label_url || '').trim();
    const hasLabel2 = Boolean(labelUrl2);
    const shippingFee2 = fee;
    const subsidy2 = subsidy;
    const orderShippingBySeller = (o as any)?.shipping_by_seller;
    const anySellerManagedCfg = items.some((it: any) => it?.shipping_by_seller === true);
    const anyGoVendyCfg = items.some((it: any) => it?.shipping_by_seller === false);
    const isSellerManagedDirect = orderShippingBySeller === true;
    const isGoVendyDirect = orderShippingBySeller === false;
    const isGoVendyConfigured = (isGoVendyDirect || (anyGoVendyCfg && !anySellerManagedCfg));
    const isPickup2 = o?.shipping_option_id === 'pickup' || o?.shipping_carrier === 'pickup';
    const isGoVendyOrder = (!isPickup2) && (
        isGoVendyConfigured ||
        (o?.shipping_option_id && o?.shipping_option_id !== 'pickup') ||
        hasLabel2 ||
        subsidy2 > 0 ||
        o?.shipping_carrier === 'gopocket'
    );
    const isSellerManaged = (isSellerManagedDirect || (anySellerManagedCfg && !anyGoVendyCfg)) || (!isPickup2 && !isGoVendyOrder && !isDigitalProduct);
    const isGoVendyFree = isGoVendyOrder && shippingFee2 === 0;
    const isSellerFree = isSellerManaged && shippingFee2 === 0 && !isPickup2;

    if (isDigitalProduct) {
        return (
            <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-xs text-indigo-900 ring-1 ring-indigo-200">
                <div className="font-bold text-indigo-700">📱 Producto Digital</div>
                <div className="mt-1 text-[11px]">Sin costo de envío. El vendedor entrega datos desde su panel.</div>
                <div className="mt-1 text-[11px] font-semibold text-indigo-600">Costo envío: $0.00</div>
                {shippedAt ? <div className="mt-1 text-[11px]">Entregado: <span className="font-semibold">{fmt(shippedAt)}</span></div> : null}
                {deliveredAt ? <div className="mt-1 text-[11px]">Confirmado: <span className="font-semibold">{fmt(deliveredAt)}</span></div> : null}
            </div>
        );
    }
    if (o?.shipping_option_id === 't1') {
        return (
            <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 text-xs text-orange-900 ring-1 ring-orange-300">
                <div className="font-bold text-orange-700">🚀 GOPOCKET PREMIUM</div>
                {carrier ? <div className="mt-1"><span className="text-orange-500">Carrier:</span> <span className="font-semibold text-orange-900">{carrier}</span></div> : null}
                {tracking ? <div className="mt-1"><span className="text-orange-500">Guía:</span> <span className="font-semibold text-orange-900">{tracking}</span></div> : null}
                <div className="mt-1 text-[11px] font-semibold text-orange-600">Costo: ${shippingFee2.toFixed(2)}{subsidy2 > 0 ? ` · Subsidio: $${subsidy2.toFixed(2)}` : ''}</div>
                {shippedAt ? <div className="mt-1 text-[11px]">Enviado: <span className="font-semibold">{fmt(shippedAt)}</span></div> : null}
                {deliveredAt ? <div className="mt-1 text-[11px]">Entregado: <span className="font-semibold">{fmt(deliveredAt)}</span></div> : null}
            </div>
        );
    }
    if (isPickup2) {
        return (
            <div className="rounded-2xl bg-white px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-200">
                <div className="font-bold text-emerald-700">🤝 Entrega Personal</div>
                <div className="mt-1 text-[11px] font-semibold text-emerald-600">Costo envío: $0.00</div>
                {shippedAt ? <div className="mt-1 text-[11px]">Vendedor entregó: <span className="font-semibold">{fmt(shippedAt)}</span></div> : null}
                {deliveredAt ? <div className="mt-1 text-[11px]">Comprador recibió: <span className="font-semibold">{fmt(deliveredAt)}</span></div> : null}
            </div>
        );
    }
    if (tracking || carrier) {
        return (
            <div className="rounded-2xl bg-gray-50 px-3 py-2 text-xs text-gray-700 ring-1 ring-black/5">
                {carrier ? <div><span className="text-gray-500">Paquetería:</span> <span className="font-semibold text-gray-900">{carrier}</span></div> : null}
                {tracking ? <div className="mt-1"><span className="text-gray-500">Guía:</span> <span className="font-semibold text-gray-900">{tracking}</span></div> : null}
                {shippedAt ? <div className="mt-1 text-[11px] text-gray-500">Enviado: {fmt(shippedAt)}</div> : null}
                {deliveredAt ? <div className="mt-1 text-[11px] text-gray-500">Entregado: {fmt(deliveredAt)}</div> : null}
            </div>
        );
    }
    if (isSellerManaged) {
        return (
            <div className="space-y-2">
                {isSellerFree ? (
                    <div className="inline-flex items-center rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">🤝 Gratis · Vendedor</div>
                ) : (
                    <div className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">📦 Vendedor · ${shippingFee2.toFixed(2)}</div>
                )}
                {o.delivery_proof_url ? (
                    <div className="flex flex-col gap-1">
                        {o.delivery_proof_url.split(',').map((url: string, idx: number) => {
                            const total = o.delivery_proof_url!.split(',').length;
                            const lb = total > 1 ? (idx === 0 ? '📄 Constancia' : '🪪 INE') : 'Ver evidencia';
                            return (
                                <a key={idx} href={url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-emerald shadow-sm ring-1 ring-emerald-200 hover:bg-white">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                    {lb}
                                </a>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-xs text-gray-500 italic">Esperando evidencia del vendedor...</div>
                )}
            </div>
        );
    }
    // GoVendy
    const totalCarrierCost = Math.max(0, shippingFee2 + subsidy2);
    return (
        <div className="space-y-1">
            {isGoVendyFree ? (
                <>
                    <div className="inline-flex items-center rounded-md bg-white px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">🎁 Envío Gratis GoVendy</div>
                    <div className="text-[11px] text-gray-600">Comprador: <span className="font-semibold text-green-700">GRATIS</span></div>
                    <div className="text-[11px] text-orange-600 font-medium">⚠️ Costo real: <span className="font-semibold">${totalCarrierCost.toFixed(2)}</span> — lo absorbe el vendedor</div>
                </>
            ) : (
                <>
                    <div className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">🚚 GoVendy · ${totalCarrierCost.toFixed(2)}</div>
                    <div className="text-[11px] text-gray-600">
                        Comprador: <span className="font-semibold">${shippingFee2.toFixed(2)}</span>
                        {subsidy2 > 0 && <> · Subsidio vendedor: <span className="font-semibold text-orange-600">${subsidy2.toFixed(2)}</span></>}
                    </div>
                </>
            )}
            {!hasLabel2 && <div className="text-[11px] text-gray-500">Aún sin rastreo.</div>}
        </div>
    );
}

function GuiaPdfContent({ o, labelUrl, hasLabel, isDownloaded, fmt }: any) {
    const isPickup = o?.shipping_option_id === 'pickup' || o?.shipping_carrier === 'pickup';
    if (isPickup) {
        return o.delivery_proof_url ? (
            <div className="flex flex-col gap-1">
                {o.delivery_proof_url.split(',').map((url: string, idx: number) => {
                    const total = o.delivery_proof_url!.split(',').length;
                    const lb = total > 1 ? (idx === 0 ? '📄 Constancia' : '🪪 INE') : 'Ver evidencia';
                    return (
                        <a key={idx} href={url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-emerald shadow-sm ring-1 ring-emerald-200 hover:bg-white">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            {lb}
                        </a>
                    );
                })}
            </div>
        ) : <div className="text-xs text-gray-500 italic">Sin evidencia subida</div>;
    }
    if (hasLabel) {
        return (
            <div className="space-y-2">
                <a href={labelUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>Ver guía</a>
                {o?.shipping_label_uploaded_at && <div className="text-[11px] text-gray-600">Subida: <span className="font-semibold text-gray-900">{fmt(o.shipping_label_uploaded_at)}</span></div>}
                <div className="text-[11px] text-gray-600">Descargada por vendedor: <span className={isDownloaded ? 'font-semibold text-green-700' : 'font-semibold text-gray-900'}>{isDownloaded ? fmt(o?.label_downloaded_at) : '—'}</span></div>
            </div>
        );
    }
    if (o?.delivery_proof_url) {
        return (
            <div className="space-y-2">
                <div className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    {(() => {
                        const isGoVendyCarrier = String(o?.shipping_carrier || '').toLowerCase() === 'gopocket' || String(o?.shipping_method || '').toLowerCase().startsWith('gopocket');
                        if (isGoVendyCarrier) return 'ENVÍOS GOVENDY';
                        return (Number(o?.shipping_fee || 0) === 0) ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍO GESTIONADO POR EL VENDEDOR';
                    })()}
                </div>
                <div className="flex flex-col gap-1">
                    {String(o.delivery_proof_url).split(',').map((url: string, idx: number) => (
                        <a key={idx} href={url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-emerald shadow-sm ring-1 ring-emerald-200 hover:bg-white">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            📄 Ver guía vendedor
                        </a>
                    ))}
                </div>
            </div>
        );
    }
    return <div className="text-xs text-gray-600">Guía pendiente</div>;
}

function UploadContent({ o, oid, fileInputId, labelStatus, isDownloaded, isUploading, uploadingOrderId, uploadLabel, isDigitalProduct, isPickupRow, itemsByOrder, fmt }: any) {
    const hasPlatformLabel = Boolean(String(o?.shipping_label_url || '').trim());
    const subsidy3 = Number((o as any)?.shipping_subsidy || 0);
    const orderItemsCfg2 = itemsByOrder[oid] || [];
    const anySellerManagedCfg2 = orderItemsCfg2.some((it: any) => it?.shipping_by_seller === true);
    const anyGoVendyCfg2 = orderItemsCfg2.some((it: any) => it?.shipping_by_seller === false);
    const isGoVendyConfigured2 = anyGoVendyCfg2 && !anySellerManagedCfg2;
    const isGoVendyOrder2 = (!isPickupRow) && (
        (o?.shipping_option_id && o?.shipping_option_id !== 'pickup') ||
        hasPlatformLabel || subsidy3 > 0 || isGoVendyConfigured2
    );
    const isSellerManaged2 = !isPickupRow && !isGoVendyOrder2;

    if (isDigitalProduct) {
        return (
            <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-800 ring-1 ring-indigo-600/20 shadow-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                    PRODUCTO DIGITAL
                </div>
                <div className="text-[11px] text-gray-700">No aplica guía de envío.</div>
            </div>
        );
    }
    if (isPickupRow) {
        return (
            <div className="space-y-2">
                <div className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">ENTREGA PERSONAL</div>
                <div className="text-[11px] text-gray-600">No aplica subir guía. Solo evidencia del vendedor.</div>
            </div>
        );
    }
    if (isSellerManaged2) {
        return (
            <div className="space-y-2">
                <div className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    {(() => {
                        const isGoVendyCarrier = String(o?.shipping_carrier || '').toLowerCase() === 'gopocket' || String(o?.shipping_method || '').toLowerCase().startsWith('gopocket');
                        if (isGoVendyCarrier) return 'ENVÍOS GOVENDY';
                        return (Number(o?.shipping_fee || 0) === 0) ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍO GESTIONADO POR EL VENDEDOR';
                    })()}
                </div>
                <div className="text-[11px] text-gray-700">El vendedor sube su guía/evidencia desde su panel.</div>
            </div>
        );
    }
    // GoVendy: upload/replace
    return (
        <div className="space-y-2">
            <input
                key={`file-input-${oid}`}
                id={fileInputId}
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={isUploading || uploadingOrderId === oid}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void uploadLabel(oid, f).then(() => { e.target.value = ''; }).catch(() => { });
                }}
            />
            {labelStatus === 'pending' ? (
                <>
                    <label htmlFor={fileInputId} className={`inline-flex cursor-pointer rounded-xl bg-brand-emerald px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isUploading ? 'Subiendo…' : 'Upload guía'}
                    </label>
                    <div className="text-[11px] text-gray-600">Al subir se notifica al vendedor para que la descargue en <span className="font-semibold">Dashboard → Ventas</span>.</div>
                </>
            ) : !isDownloaded ? (
                <>
                    <div className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-extrabold text-amber-900">En espera</div>
                    <label htmlFor={fileInputId} className={`inline-flex cursor-pointer rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Reemplazar guía">
                        {isUploading ? 'Subiendo…' : 'Reemplazar guía'}
                    </label>
                    <div className="text-[11px] text-amber-900/80">Ya se subió la guía. Falta que el vendedor la descargue.</div>
                </>
            ) : (
                <>
                    <div className="inline-flex items-center rounded-xl border border-green-200 bg-white px-4 py-2 text-xs font-extrabold text-green-800">Descargada</div>
                    <label htmlFor={fileInputId} className={`inline-flex cursor-pointer rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Re-subir guía">
                        {isUploading ? 'Subiendo…' : 'Re-subir guía'}
                    </label>
                    <div className="text-[11px] text-green-800/80">Descargada por el vendedor: <span className="font-semibold">{fmt(o?.label_downloaded_at)}</span></div>
                </>
            )}
        </div>
    );
}
