'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

function formatMoney(v: number) {
    return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatDateTime(input: string | null | undefined) {
    if (!input) return '—';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Quote = {
    id: string;
    status: string;
    calculated_cost: number;
    sender_name: string;
    sender_city: string;
    sender_state: string;
    sender_postal_code: string;
    recipient_name: string;
    recipient_city: string;
    recipient_state: string;
    recipient_postal_code: string;
    guide_file_url: string | null;
    guide_uploaded_at: string | null;
    created_at: string;
    paid_at: string | null;
    completed_at: string | null;
    weight_kg: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
};

export default function MisGuiasEstafetaPage() {
    const [loading, setLoading] = useState(true);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const { data: sess } = await supabase.auth.getSession();
                const token = sess.session?.access_token;
                if (!token) {
                    window.location.href = '/login?returnTo=/estafeta/mis-guias';
                    return;
                }

                const res = await fetch(`/api/estafeta/my-quotes?_t=${Date.now()}`, {
                    headers: { authorization: `Bearer ${token}` },
                    cache: 'no-store',
                });

                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.error || 'Error al cargar guías');

                setQuotes((json.quotes || []) as Quote[]);
            } catch (e: any) {
                setError(e.message || 'Error inesperado');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    const statusLabel = (s: string) => {
        switch (s) {
            case 'paid': return { text: 'Pagada — Guía en preparación', color: 'bg-amber-100 text-amber-800' };
            case 'processing': return { text: 'Procesando', color: 'bg-blue-100 text-blue-800' };
            case 'completed': return { text: 'Completada ✓', color: 'bg-green-100 text-green-800' };
            case 'quote': return { text: 'Cotizada (sin pagar)', color: 'bg-gray-100 text-gray-600' };
            case 'pending_payment': return { text: 'Pendiente de pago', color: 'bg-yellow-100 text-yellow-800' };
            default: return { text: s, color: 'bg-gray-100 text-gray-600' };
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white">
                <div className="mx-auto max-w-4xl px-4 py-16 text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-emerald border-t-transparent" />
                    <p className="mt-4 text-sm text-gray-500">Cargando tus guías...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <img src="/estafeta-logo.svg" alt="Estafeta" className="h-8 w-auto" />
                        <div>
                            <div className="text-sm font-semibold text-gray-900">Mis Guías de Envío</div>
                            <div className="text-xs text-gray-500">Historial de guías Estafeta compradas</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link
                            href="/estafeta/cotizar"
                            className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-emerald/90 transition"
                        >
                            + Nueva Guía
                        </Link>
                        <Link
                            href="/dashboard"
                            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                        >
                            Volver
                        </Link>
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-4xl px-4 py-8">
                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                {quotes.length === 0 ? (
                    <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
                        <div className="text-5xl">📦</div>
                        <h2 className="mt-4 text-lg font-bold text-gray-900">No tienes guías de envío</h2>
                        <p className="mt-2 text-sm text-gray-500">Cotiza y compra tu primera guía Estafeta</p>
                        <Link
                            href="/estafeta/cotizar"
                            className="mt-6 inline-block rounded-xl bg-brand-emerald px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-brand-emerald/90"
                        >
                            Cotizar envío
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {quotes.map((q) => {
                            const st = statusLabel(q.status);
                            return (
                                <div
                                    key={q.id}
                                    className={`rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${q.guide_file_url ? 'border-green-300 ring-1 ring-green-200' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex-1">
                                            {/* Status badge + date */}
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.color}`}>{st.text}</span>
                                                <span className="text-xs text-gray-400">{formatDateTime(q.created_at)}</span>
                                            </div>

                                            {/* Route */}
                                            <div className="flex items-center gap-2 text-sm">
                                                <div className="rounded-lg bg-gray-100 px-3 py-1.5">
                                                    <div className="text-[10px] font-semibold text-gray-500 uppercase">De</div>
                                                    <div className="font-semibold text-gray-900">{q.sender_name}</div>
                                                    <div className="text-xs text-gray-600">{q.sender_city}, {q.sender_state} {q.sender_postal_code}</div>
                                                </div>
                                                <div className="text-gray-400">→</div>
                                                <div className="rounded-lg bg-gray-100 px-3 py-1.5">
                                                    <div className="text-[10px] font-semibold text-gray-500 uppercase">A</div>
                                                    <div className="font-semibold text-gray-900">{q.recipient_name}</div>
                                                    <div className="text-xs text-gray-600">{q.recipient_city}, {q.recipient_state} {q.recipient_postal_code}</div>
                                                </div>
                                            </div>

                                            {/* Package + cost */}
                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                                <span>📦 {q.weight_kg} kg · {q.length_cm}×{q.width_cm}×{q.height_cm} cm</span>
                                                <span className="font-bold text-brand-emerald text-sm">{formatMoney(q.calculated_cost)}</span>
                                                {q.paid_at && <span>Pagado: {formatDateTime(q.paid_at)}</span>}
                                            </div>
                                        </div>

                                        {/* Download button */}
                                        <div className="flex flex-col items-end gap-2">
                                            {q.guide_file_url ? (
                                                <>
                                                    <a
                                                        href={q.guide_file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-green-700 transition-all"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                        Descargar Guía
                                                    </a>
                                                    {q.guide_uploaded_at && (
                                                        <span className="text-[10px] text-green-700">
                                                            Subida: {formatDateTime(q.guide_uploaded_at)}
                                                        </span>
                                                    )}
                                                </>
                                            ) : q.status === 'paid' || q.status === 'processing' ? (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                                                    <div className="text-xs font-bold text-amber-900">⏳ En preparación</div>
                                                    <div className="mt-1 text-[10px] text-amber-700">
                                                        Tu guía será subida pronto
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

