'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DashboardSuspendidoPage() {
    const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const res = await fetch(`/api/support/user-state?userId=${user.id}`);
                if (res.ok) {
                    const json = await res.json();
                    setSuspendedUntil(json?.suspended_until || null);
                }
            } catch { /* ignore */ }
            finally { setLoading(false); }
        })();
    }, []);

    // Tick every second for countdown
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const countdown = useMemo(() => {
        if (!suspendedUntil) return null;
        const end = new Date(suspendedUntil).getTime();
        const diff = Math.max(0, end - now);
        if (diff <= 0) return { ended: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return { ended: false, days, hours, minutes, seconds };
    }, [suspendedUntil, now]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50/50 to-gray-50 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-lg ring-1 ring-amber-100">
                {/* Icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 shadow-inner">
                    <span className="text-4xl" aria-hidden="true">⏱</span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-extrabold text-gray-900">
                    Cuenta Suspendida
                </h1>

                {/* Description */}
                <p className="mt-4 text-sm leading-relaxed text-gray-600">
                    Tu cuenta ha sido <strong className="text-amber-700">suspendida temporalmente</strong>.
                    No puedes comprar, vender ni publicar hasta que termine la suspensión.
                </p>

                {/* Countdown */}
                {loading ? (
                    <div className="mt-6 animate-pulse text-sm text-gray-400">Cargando...</div>
                ) : countdown && !countdown.ended ? (
                    <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-amber-50 px-6 py-4 ring-1 ring-amber-200">
                        <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Tiempo restante</span>
                        <div className="flex gap-1.5 font-mono text-2xl font-black tabular-nums text-amber-900">
                            {countdown.days > 0 && <span>{countdown.days}<span className="text-base font-bold text-amber-600">d</span></span>}
                            <span>{String(countdown.hours).padStart(2, '0')}<span className="text-base font-bold text-amber-600">h</span></span>
                            <span>{String(countdown.minutes).padStart(2, '0')}<span className="text-base font-bold text-amber-600">m</span></span>
                            <span>{String(countdown.seconds).padStart(2, '0')}<span className="text-base font-bold text-amber-600">s</span></span>
                        </div>
                    </div>
                ) : countdown?.ended ? (
                    <div className="mt-6 rounded-xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-900 ring-1 ring-green-200">
                        ¡La suspensión ha terminado! Recarga la página para continuar.
                    </div>
                ) : null}

                {/* Divider */}
                <div className="my-6 border-t border-gray-200" />

                {/* What you CAN do */}
                <div className="rounded-xl bg-gray-50 px-5 py-4">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                        Solo puedes acceder a:
                    </p>
                    <div className="flex flex-col gap-2">
                        <Link
                            href="/dashboard/soporte"
                            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-orange-300 hover:shadow-md"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                                💬
                            </span>
                            Soporte
                            <span className="ml-auto text-xs text-gray-400">→</span>
                        </Link>
                        <Link
                            href="/dashboard/ayuda"
                            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-blue-300 hover:shadow-md"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                ❓
                            </span>
                            Centro de Ayuda
                            <span className="ml-auto text-xs text-gray-400">→</span>
                        </Link>
                        <Link
                            href="/dashboard/notificaciones"
                            className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-green-300 hover:shadow-md"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
                                🔔
                            </span>
                            Notificaciones
                            <span className="ml-auto text-xs text-gray-400">→</span>
                        </Link>
                    </div>
                </div>

                {/* Support CTA */}
                <Link
                    href="/dashboard/soporte"
                    className="mt-6 inline-block rounded-xl bg-orange-500 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-orange-600 hover:shadow-lg"
                >
                    Ir a Soporte
                </Link>
            </div>
        </div>
    );
}
