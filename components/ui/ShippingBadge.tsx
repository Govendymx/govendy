'use client';

import React from 'react';

export interface ShippingBadgeProps {
    shippingOptionId?: string | null;
    shippingCarrier?: string | null;
    shippingBySeller?: boolean | null;
    shippingFee?: number | null;
    shippingMethod?: string | null;
    isDigital?: boolean;
    isGoVendyFree?: boolean;
    /** Show Subasta or Venta Directa chip */
    isAuction?: boolean;
    /** Show both shipping + order source badges */
    showOrderSource?: boolean;
    /** Compact mode for smaller cards */
    compact?: boolean;
}

/* ─── Shipping type chip ─── */
function ShippingTypeChip({
    shippingOptionId,
    shippingCarrier,
    shippingBySeller,
    shippingFee,
    shippingMethod,
    isDigital,
    isGoVendyFree,
}: ShippingBadgeProps) {
    const optId = String(shippingOptionId || '').toLowerCase().trim();
    const carrier = String(shippingCarrier || '').trim();
    const carrierLower = carrier.toLowerCase();
    const bySeller = Boolean(shippingBySeller);
    const fee = Number(shippingFee || 0);
    const isPickup = optId === 'pickup' || carrierLower === 'pickup';

    if (isDigital) {
        return (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200">
                📱 Digital
            </span>
        );
    }

    if (isPickup) {
        return (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold bg-purple-100 text-purple-700 ring-1 ring-purple-200">
                🤝 Entrega Personal
            </span>
        );
    }

    // ── T1 / GoVendy PREMIUM ──
    const method = String(shippingMethod || '').toLowerCase().trim();
    if (optId === 't1' || method === 'gopocket_premium') {
        const carrierLabel = carrier && carrierLower !== 't1' ? ` · ${carrier}` : '';
        return (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 ring-1 ring-orange-300">
                🚀 ENVÍO PREMIUM{carrierLabel}
            </span>
        );
    }

    if (isGoVendyFree || (carrierLower === 'gopocket' && fee === 0 && !bySeller)) {
        return (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold bg-pink-100 text-pink-700 ring-1 ring-pink-200">
                🚀 GoVendy Gratis
            </span>
        );
    }

    if (bySeller) {
        return (
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${fee === 0 ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'}`}>
                📦 {fee === 0 ? 'Vendedor Gratis' : 'Gestionado Vendedor'}
            </span>
        );
    }

    // Default: GoVendy paid shipping
    return (
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold bg-sky-100 text-sky-700 ring-1 ring-sky-200">
            🚀 GoVendy
        </span>
    );
}

/* ─── Order source chip ─── */
function OrderSourceChip({ isAuction }: { isAuction?: boolean }) {
    if (isAuction) {
        return (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200">
                🔨 Subasta
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
            🛒 Venta Directa
        </span>
    );
}

/* ─── Combined badge ─── */
export function ShippingBadge(props: ShippingBadgeProps) {
    const { showOrderSource = true, isAuction } = props;
    return (
        <div className="flex flex-wrap gap-1">
            <ShippingTypeChip {...props} />
            {showOrderSource && <OrderSourceChip isAuction={isAuction} />}
        </div>
    );
}

export { ShippingTypeChip, OrderSourceChip };
