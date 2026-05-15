'use client';

import React from 'react';
import Link from 'next/link';
import { CopyButton } from '@/components/ui/CopyButton';
import { ShippingBadge } from '@/components/ui/ShippingBadge';

export interface PagosRowProps {
    r: any;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    profiles: Record<string, any>;
    fmtDateTime: (d: any) => string;
    renderStatus: (raw: any, row?: any) => React.ReactNode;
    handleAccreditOrder: (checkoutId: string) => void;
    handleRejectOrder: (checkoutId: string) => void;
    handleApproveTopup: (topupId: string) => void;
    handleCheckMpStatus: (checkoutId: string, mpPaymentId: string | null, type: 'order' | 'topup') => void;
    processingIds: Set<string>;
}

export function PagosRow({
    r, isExpanded, onToggle,
    profiles, fmtDateTime, renderStatus,
    handleAccreditOrder, handleRejectOrder, handleApproveTopup, handleCheckMpStatus,
    processingIds,
}: PagosRowProps) {
    const type = r._type;
    const isOrder = type === 'order';
    const isTopup = type === 'topup';
    const isWallet = type === 'wallet';
    const rowId = `${type}-${r.id}`;
    const rid = String(r.id);

    // ── Derived data ──
    const buyerId = isOrder ? r.buyer_id : (r as any).buyer_id;
    const sellerId = (r as any).seller_id;
    const buyerName = profiles[buyerId]?.full_name || (r as any).buyer_name_snapshot || (buyerId ? `${buyerId.slice(0, 8)}…` : '—');
    const sellerName = sellerId ? (profiles[sellerId]?.full_name || `${sellerId.slice(0, 8)}…`) : '';
    const amount = Number(isOrder ? (r.amount || r.orders_total || 0) : (r.amount || (r as any).order_total || 0));

    // Product info
    const productTitle = isOrder
        ? (r.first_product_title || '—')
        : isWallet && (r as any)._is_order_payment
            ? ((r as any).product_title || (r as any).concept || 'PocketCash')
            : isTopup ? 'Recarga de Saldo' : String(r.concept || 'PocketCash');
    const productThumb = isOrder ? r.first_product_thumb : (r as any).product_thumb;

    // Type badge
    const typeBadge = isOrder ? (
        <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">📦</span>
            {(r as any)?.payment_method === 'mercadopago' && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700 ring-1 ring-sky-200">MP</span>}
            {(r as any)?.payment_method === 'pocketcash' && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">💰</span>}
        </div>
    ) : isWallet && (r as any)._is_order_payment ? (
        <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">📦</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">💰</span>
        </div>
    ) : isTopup ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">💳</span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">💰</span>
    );

    return (
        <React.Fragment>
            {/* ── COMPACT SUMMARY ROW ── */}
            <tr
                className={`cursor-pointer transition-colors ${isExpanded ? 'bg-purple-50/60' : isOrder ? 'hover:bg-purple-50/40' : 'hover:bg-blue-50/40'}`}
                onClick={() => onToggle(rowId)}
            >
                {/* Chevron */}
                <td className="px-3 py-3 text-center">
                    <span className={`inline-block transition-transform duration-200 text-gray-400 text-sm ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                </td>
                {/* Tipo + Ref */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        {typeBadge}
                        <div>
                            <div className="text-xs font-semibold text-gray-900 flex items-center gap-1">
                                {String(r.reference_code || r.id).slice(0, 10)}{String(r.reference_code || r.id).length > 10 ? '…' : ''}
                                <CopyButton text={String(r.reference_code || r.id)} className="text-gray-300 hover:text-gray-600" iconSize={12} />
                            </div>
                            <div className="text-[11px] text-gray-500">{fmtDateTime(r.created_at)}</div>
                        </div>
                    </div>
                </td>
                {/* Concepto */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        {productThumb ? (
                            <img src={String(productThumb)} alt="" className="h-10 w-10 flex-none rounded-lg object-cover ring-1 ring-black/10 shadow-sm" loading="lazy" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="h-10 w-10 flex-none rounded-lg bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center text-gray-400 text-lg">
                                {isOrder ? '📦' : isTopup ? '💳' : '💰'}
                            </div>
                        )}
                        <span className="text-xs font-medium text-gray-900 truncate max-w-[200px]">{productTitle}</span>
                    </div>
                </td>
                {/* Monto */}
                <td className="px-4 py-3">
                    <span className="text-sm font-bold text-green-600">${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </td>
                {/* Comprador → Vendedor */}
                <td className="px-4 py-3">
                    <div className="text-xs">
                        <span className="font-semibold text-gray-900">{buyerName}</span>
                        {sellerName && <>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="font-semibold text-gray-900">{sellerName}</span>
                        </>}
                    </div>
                </td>
                {/* Estado */}
                <td className="px-4 py-3">
                    {renderStatus(r.status, r)}
                </td>
            </tr>

            {/* ── EXPANDABLE DETAIL ── */}
            {isExpanded && (
                <tr className="bg-gradient-to-b from-purple-50/40 to-white">
                    <td colSpan={6} className="px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* SEC 1: Referencia & Usuarios */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider border-b pb-1">🔖 Referencia & Usuarios</h4>
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Referencia</div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-gray-900 font-mono">{String(r.reference_code || '—')}</span>
                                        {r.reference_code && <CopyButton text={String(r.reference_code)} className="text-gray-300 hover:text-purple-600" iconSize={14} />}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono mt-1">
                                        ID: {rid.slice(0, 8)}…
                                        <CopyButton text={rid} className="text-gray-300 hover:text-gray-600" iconSize={12} />
                                    </div>
                                    {(() => {
                                        const orderIds = Array.isArray((r as any).order_ids) ? (r as any).order_ids : [];
                                        const firstOrderId = orderIds.length > 0 ? String(orderIds[0] || '').trim() : '';
                                        if (!firstOrderId) return null;
                                        return (
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Orden:</span>
                                                <span className="text-[11px] font-mono text-gray-700">{firstOrderId.slice(0, 8)}…{firstOrderId.slice(-4)}</span>
                                                <CopyButton text={firstOrderId} className="text-gray-300 hover:text-emerald-600" iconSize={12} />
                                            </div>
                                        );
                                    })()}
                                </div>
                                {/* Comprador */}
                                {(isOrder || (isWallet && (r as any)._is_order_payment)) && (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase text-blue-500 mb-1">Comprador</div>
                                        <div className="text-sm font-bold text-gray-900">{buyerName}</div>
                                        <div className="text-[11px] text-gray-500">{profiles[buyerId]?.email || (r as any).buyer_email_snapshot || ''}</div>
                                    </div>
                                )}
                                {/* Vendedor */}
                                {sellerId && (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase text-orange-500 mb-1">Vendedor</div>
                                        <div className="text-sm font-semibold text-gray-800">{profiles[sellerId]?.full_name || `${sellerId.slice(0, 8)}…`}</div>
                                        <div className="text-[11px] text-gray-500">{profiles[sellerId]?.email || ''}</div>
                                    </div>
                                )}
                                {/* For topups/wallet without order */}
                                {!isOrder && !(isWallet && (r as any)._is_order_payment) && (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Usuario</div>
                                        {(() => {
                                            const uid = r.user_id || r.wallet_id;
                                            return (
                                                <>
                                                    <div className="text-sm font-bold text-gray-900">{profiles[uid]?.full_name || r.user?.full_name || (uid ? `${uid.slice(0, 8)}…` : '—')}</div>
                                                    <div className="text-[11px] text-gray-500">{profiles[uid]?.email || r.user?.email || ''}</div>
                                                    {uid && <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mt-0.5">ID: {uid.slice(0, 8)}… <CopyButton text={uid} className="text-gray-400 hover:text-brand-emerald" iconSize={10} /></div>}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* SEC 2: Producto & Envío */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider border-b pb-1">📦 Producto & Envío</h4>
                                {/* Product detail */}
                                {(isOrder || (isWallet && (r as any)._is_order_payment)) && (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Producto</div>
                                        <div className="flex items-center gap-2">
                                            {productThumb && <img src={String(productThumb)} alt="" className="h-10 w-10 rounded object-cover ring-1 ring-black/10" loading="lazy" referrerPolicy="no-referrer" />}
                                            <div>
                                                {(() => {
                                                    const pid = isOrder ? r.first_product_id : (r as any).product_id;
                                                    const pslug = isOrder ? r.first_product_slug : (r as any).product_slug;
                                                    const ptitle = isOrder ? r.first_product_title : (r as any).product_title;
                                                    if (pid) {
                                                        return <Link href={`/listings/${pslug || pid}`} target="_blank" className="text-xs text-brand-emerald hover:underline font-medium">{ptitle || 'Sin título'}</Link>;
                                                    }
                                                    return <span className="text-xs text-gray-700">{ptitle || productTitle}</span>;
                                                })()}
                                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                                    {(Boolean((r as any).is_auction) || String((r as any).order_source || '').toLowerCase() === 'auction') && (r as any).is_digital ? (
                                                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">📱🔨 Subasta Producto Digital</span>
                                                    ) : (Boolean((r as any).is_auction) || String((r as any).order_source || '').toLowerCase() === 'auction') ? (
                                                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">🔨 Subasta</span>
                                                    ) : (r as any).is_digital ? (
                                                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">📱 Producto Digital</span>
                                                    ) : (isOrder || (r as any).product_id) ? (
                                                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">🛒 Venta Directa</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Shipping */}
                                {(isOrder || (isWallet && (r as any)._is_order_payment)) && (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Envío</div>
                                        {(() => {
                                            const optId = String((r as any).shipping_option_id || '').toLowerCase();
                                            const carrier = String((r as any).shipping_carrier || '').toLowerCase();
                                            const productType = String((r as any).product_type || (r as any).first_product_type || '').toLowerCase();
                                            const derivedDigital = productType === 'digital' || optId === 'digital' || carrier === 'digital' || Boolean((r as any).is_digital);
                                            const derivedBySeller = Boolean((r as any).shipping_by_seller) ||
                                                (!derivedDigital && optId !== 'pickup' && carrier !== 'pickup' && carrier !== '' && carrier !== 'gopocket' && !optId);
                                            return (
                                                <ShippingBadge
                                                    shippingOptionId={(r as any).shipping_option_id}
                                                    shippingCarrier={(r as any).shipping_carrier}
                                                    shippingBySeller={derivedBySeller}
                                                    shippingFee={Number(isOrder ? ((r as any).shipping_gross_total || (r as any).shipping_total || 0) : ((r as any).shipping_fee || 0))}
                                                    shippingMethod={(r as any).shipping_method}
                                                    isDigital={derivedDigital}
                                                    isGoVendyFree={Boolean((r as any).is_gopocket_free)}
                                                    isAuction={Boolean((r as any).is_auction) || String((r as any).order_source || '').toLowerCase() === 'auction'}
                                                    showOrderSource={true}
                                                />
                                            );
                                        })()}
                                        {!(r as any).is_digital && (
                                            <div className="mt-2 space-y-1">
                                                <div className="text-xs font-semibold text-blue-700">
                                                    Envío: ${Number((isOrder ? (r as any).shipping_gross_total : (r as any).shipping_fee) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                </div>
                                                {isOrder && (
                                                    <div className="text-[11px] text-gray-600">
                                                        Comprador: <span className="font-semibold">${Number((r as any).shipping_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> · Subsidio: <span className="font-semibold">${Number((r as any).shipping_subsidy_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                                {(() => {
                                                    const bySeller = Boolean((r as any).shipping_by_seller);
                                                    const optId = String((r as any).shipping_option_id || '').toLowerCase();
                                                    const carrier = String((r as any).shipping_carrier || '').toLowerCase();
                                                    const isPickupOrder = optId === 'pickup' || carrier === 'pickup';
                                                    if (!bySeller || isPickupOrder) return null;
                                                    const netSeller = Number((r as any).net_total || 0);
                                                    const shippingForSeller = Number(isOrder ? ((r as any).shipping_gross_total || (r as any).shipping_total || 0) : ((r as any).shipping_fee || 0));
                                                    const sellerGets = netSeller + shippingForSeller;
                                                    return (
                                                        <div className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                                                            💰 Vendedor cobra: ${sellerGets.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* SEC 3: Desglose & Acciones */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider border-b pb-1">💰 Desglose & Acciones</h4>
                                {/* Financial breakdown */}
                                {(isOrder || (isWallet && (r as any)._is_order_payment)) ? (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm space-y-1.5">
                                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Desglose</div>
                                        {/* Subtotal */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500">Subtotal:</span>
                                            <span className="font-semibold text-gray-800">
                                                + ${Number(isOrder ? (Number((r as any).orders_total || r.amount || 0) - Number((r as any).shipping_total || 0)) : ((r as any).subtotal || (Number((r as any).order_total || 0) - Number((r as any).shipping_fee || 0)))).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {/* Comisión */}
                                        {(() => {
                                            const commAmt = Number(isOrder ? ((r as any).commission_total || 0) : ((r as any).commission_fee || 0));
                                            const subtotalAmt = Number(isOrder ? (Number((r as any).orders_total || r.amount || 0) - Number((r as any).shipping_total || 0)) : ((r as any).subtotal || (Number((r as any).order_total || 0) - Number((r as any).shipping_fee || 0))));
                                            const commPctNum = subtotalAmt > 0 ? (commAmt / subtotalAmt) * 100 : 0;
                                            const isMinFloor = commPctNum > 23.5;
                                            return (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Comisión:</span>
                                                    <span className="font-semibold text-orange-600 flex items-center gap-1">
                                                        - ${commAmt.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        {commPctNum > 0 && (
                                                            <span className={`ml-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${isMinFloor ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {isMinFloor ? 'Mín.' : `${commPctNum.toFixed(1)}%`}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        {/* Envío */}
                                        {(() => {
                                            const sFee = Number(isOrder ? ((r as any).shipping_gross_total || (r as any).shipping_total || 0) : ((r as any).shipping_fee || 0));
                                            if (sFee === 0) return null;
                                            const shippingBySeller = (r as any).shipping_by_seller === true;
                                            const isPickup = (r as any).shipping_option_id === 'pickup' || (r as any).shipping_carrier === 'pickup';
                                            const carrier = String((r as any).shipping_carrier || '').toLowerCase();
                                            const isPlatform = !isPickup && (!shippingBySeller || carrier === 'gopocket' || carrier === '');
                                            return (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-gray-500">Envío:</span>
                                                    <span className={`font-semibold ${isPlatform ? 'text-red-500' : 'text-blue-600'}`}>
                                                        {isPlatform ? '-' : '+'} ${sFee.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        {/* Neto vendedor */}
                                        {isOrder && (
                                            <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100 italic">
                                                <span className="text-gray-600">Neto vendedor:</span>
                                                <span className="font-bold text-purple-600">= ${Number((r as any).net_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {/* Total */}
                                        <div className="flex justify-between items-center text-sm pt-1 border-t-2 border-gray-200 mt-1">
                                            <span className="font-bold text-gray-700">Pago Comprador:</span>
                                            <span className="font-bold text-green-600">${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Monto</div>
                                        <div className="text-lg font-bold text-green-600">${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-2">Acciones</div>
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            href={isOrder ? `/admin/operations?paymentId=${r.id}` : `/admin/operations?topupId=${r.id}`}
                                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-bold inline-block"
                                        >
                                            Ver Detalle
                                        </Link>
                                        {/* Link directo a Logística */}
                                        {(isOrder || (isWallet && (r as any)._is_order_payment)) && (() => {
                                            const orderIds = Array.isArray((r as any).order_ids) ? (r as any).order_ids : [];
                                            const firstOrderId = orderIds.length > 0 ? String(orderIds[0] || '').trim() : '';
                                            if (!firstOrderId) return null;
                                            return (
                                                <Link
                                                    href={`/admin/logistica?search=${firstOrderId}`}
                                                    className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 text-xs font-bold inline-flex items-center gap-1"
                                                >
                                                    🚚 Ver en Logística
                                                </Link>
                                            );
                                        })()}
                                        {isOrder ? (
                                            <>
                                                {r.payment_proof_url && (
                                                    <a href={r.payment_proof_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-bold inline-block">Ver Comprobante</a>
                                                )}
                                                {String(r.status) === 'pending' && (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); handleAccreditOrder(rid); }} disabled={processingIds.has(rid)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs font-bold disabled:opacity-50">
                                                            {processingIds.has(rid) ? '...' : 'Aprobar'}
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleRejectOrder(rid); }} disabled={processingIds.has(rid)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs font-bold disabled:opacity-50">
                                                            {processingIds.has(rid) ? '...' : 'Rechazar'}
                                                        </button>
                                                    </>
                                                )}
                                                {((r as any)?.payment_method === 'mercadopago' && String(r.status) !== 'paid' && String(r.status) !== 'approved') && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleCheckMpStatus(rid, (r as any)?.mp_payment_id || null, 'order'); }} disabled={processingIds.has(rid)} className="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 text-xs font-bold disabled:opacity-50 flex items-center gap-1">
                                                        {processingIds.has(rid) ? '...' : (<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>Verificar MP</>)}
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {r.metadata?.proof_url && (
                                                    <a href={r.metadata.proof_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-xs font-bold inline-block">Ver Nota</a>
                                                )}
                                                {(String(r.status) === 'pending' || String(r.status) === 'pending_approval') && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleApproveTopup(rid); }} disabled={processingIds.has(rid)} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-xs font-bold disabled:opacity-50">
                                                        {processingIds.has(rid) ? '...' : 'Aprobar'}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}
