'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * DigitalDeliverySection — for Ventas (seller side)
 * Shows delivery form for digital products after payment.
 */
export function DigitalDeliverySeller({
    orderId,
    listingId,
    deliveryFields,
    onDelivered,
}: {
    orderId: string;
    listingId: string;
    deliveryFields: { label: string }[];
    onDelivered?: () => void;
}) {
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [existingDelivery, setExistingDelivery] = useState<Record<string, string> | null>(null);

    // Check if already delivered
    useEffect(() => {
        (async () => {
            try {
                const { data: sess } = await supabase.auth.getSession();
                const token = sess.session?.access_token;
                if (!token) return;
                const res = await fetch(`/api/orders/digital-delivery?order_id=${orderId}`, {
                    headers: { authorization: `Bearer ${token}` },
                });
                const json = await res.json();
                if (json.ok && json.delivered && json.delivery?.fields) {
                    setExistingDelivery(json.delivery.fields);
                    setFieldValues(json.delivery.fields);
                    setSubmitted(true);
                }
            } catch { }
        })();
    }, [orderId]);

    const handleSubmit = async () => {
        // Validate all fields have values
        const emptyFields = deliveryFields.filter(f => !fieldValues[f.label]?.trim());
        if (emptyFields.length > 0) {
            setError(`Completa todos los campos: ${emptyFields.map(f => f.label).join(', ')}`);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) throw new Error('No autenticado');

            const res = await fetch('/api/orders/digital-deliver', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    order_id: orderId,
                    fields: fieldValues,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Error al entregar');

            setSubmitted(true);
            setExistingDelivery(fieldValues);
            onDelivered?.();
        } catch (e: any) {
            setError(e.message || 'Error inesperado');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted && existingDelivery) {
        return (
            <div className="rounded-xl border-2 border-green-200 bg-white p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm">✅</span>
                    <span className="text-xs font-bold text-green-800">Producto digital entregado</span>
                </div>
                <div className="space-y-1">
                    {Object.entries(existingDelivery).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-green-700">{key}:</span>
                            <span className="font-mono text-green-900">{val}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🔑</span>
                <span className="text-xs font-bold text-purple-800">Entrega Digital Pendiente</span>
            </div>
            <p className="text-[10px] text-purple-600 mb-2">
                Completa los datos para entregar al comprador:
            </p>
            <div className="space-y-1.5">
                {deliveryFields.map((field) => (
                    <div key={field.label}>
                        <label className="text-[10px] font-semibold text-purple-700">{field.label}</label>
                        <input
                            type="text"
                            value={fieldValues[field.label] || ''}
                            onChange={(e) => setFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                            className="w-full rounded-md border border-purple-200 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder={`Ingresa ${field.label}`}
                        />
                    </div>
                ))}
            </div>
            {error && <p className="text-[10px] text-red-600 font-semibold">{error}</p>}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-lg bg-purple-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
            >
                {isSubmitting ? 'Entregando...' : '✅ Confirmar Entrega Digital'}
            </button>
        </div>
    );
}

/**
 * DigitalDeliveryBuyer — for Compras (buyer side)
 * Shows the delivered data or a waiting message.
 */
export function DigitalDeliveryBuyer({ orderId }: { orderId: string }) {
    const [delivery, setDelivery] = useState<Record<string, string> | null>(null);
    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState<Record<string, boolean>>({});
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { data: sess } = await supabase.auth.getSession();
                const token = sess.session?.access_token;
                if (!token) return;
                const res = await fetch(`/api/orders/digital-delivery?order_id=${orderId}`, {
                    headers: { authorization: `Bearer ${token}` },
                });
                const json = await res.json();
                if (json.ok && json.delivered && json.delivery?.fields) {
                    setDelivery(json.delivery.fields);
                }
            } catch { } finally {
                setLoading(false);
            }
        })();
    }, [orderId]);

    const copyToClipboard = (key: string, value: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(key);
            setTimeout(() => setCopied(null), 2000);
        });
    };

    if (loading) {
        return (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3">
                <p className="text-[10px] text-purple-500 animate-pulse">Cargando datos digitales...</p>
            </div>
        );
    }

    if (!delivery) {
        return (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm">⏳</span>
                    <span className="text-xs font-bold text-amber-800">Esperando entrega del vendedor</span>
                </div>
                <p className="text-[10px] text-amber-600 mt-1">
                    El vendedor aun no ha entregado los datos de tu producto digital. Recibirás una notificación cuando estén listos.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border-2 border-green-200 bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-sm">🔑</span>
                <span className="text-xs font-bold text-green-800">Datos de tu producto digital</span>
            </div>
            <div className="space-y-1.5">
                {Object.entries(delivery).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 rounded-lg bg-white/80 px-2 py-1.5 ring-1 ring-green-200">
                        <span className="text-[10px] font-bold text-green-700 min-w-[60px]">{key}:</span>
                        <span className="flex-1 font-mono text-xs text-green-900">
                            {showValues[key] ? val : '••••••••'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowValues(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="text-[10px] text-green-600 hover:text-green-800 font-semibold"
                        >
                            {showValues[key] ? '🙈' : '👁'}
                        </button>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(key, val)}
                            className="text-[10px] text-green-600 hover:text-green-800 font-semibold"
                        >
                            {copied === key ? '✅' : '📋'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
