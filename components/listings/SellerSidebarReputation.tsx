'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { FollowButton } from '@/components/FollowButton';

interface RepData {
    name: string;
    operations_count: number;
    state: string;
    city: string;
    isVerified: boolean;
    overall: { percent: number };
    seller: { percent: number };
    buyer: { percent: number };
    stats: {
        total_orders: number;
        cancelled_orders: number;
        cancellation_rate: number;
        fast_shipping_count: number;
        delayed_shipping_count: number;
        average_shipping_days: number | null;
        has_problems: boolean;
        disputes_count: number;
    };
}

export function SellerSidebarReputation({ sellerId, onLoginRequired }: { sellerId: string; onLoginRequired?: () => void }) {
    const [data, setData] = useState<RepData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchReputation() {
            try {
                const res = await fetch(`/api/reputation/${sellerId}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error('Error fetching reputation for sidebar:', err);
            } finally {
                setLoading(false);
            }
        }

        if (sellerId) {
            fetchReputation();
        }
    }, [sellerId]);

    if (loading || !data) return null;

    const { overall, seller, buyer, stats } = data;

    return (
        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href={`/perfil/${sellerId}`}
                    className="text-sm font-bold text-gray-900 line-clamp-1 hover:text-brand-emerald transition-colors"
                >
                    {data.name}
                </Link>
                {data.isVerified && <VerifiedBadge size="sm" />}
                {data.operations_count >= 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                        {data.operations_count} ops
                    </span>
                )}
                <FollowButton sellerId={sellerId} compact className="ml-auto" onLoginRequired={onLoginRequired} />
            </div>

            {(data.state || data.city) && (
                <div className="mt-1 text-[10px] text-gray-500 uppercase font-semibold">
                    {[data.state, data.city].filter(Boolean).join(', ')}
                </div>
            )}

            <div className="mt-4 space-y-4">
                <MiniThermometer percent={overall?.percent ?? 0} label="Reputación general" />
                <MiniThermometer percent={seller?.percent ?? 0} label="Como vendedor" />
                <MiniThermometer percent={buyer?.percent ?? 0} label="Como comprador" />
            </div>

            {stats && stats.total_orders > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-2">
                    <StatBox
                        label="Cancelaciones"
                        value={`${stats.cancellation_rate}%`}
                        status={stats.cancellation_rate <= 5 ? 'success' : stats.cancellation_rate <= 15 ? 'warning' : 'error'}
                    />
                    <StatBox
                        label="Velocidad envío"
                        value={stats.average_shipping_days !== null ? `${stats.average_shipping_days}d` : '--'}
                        status={stats.average_shipping_days !== null && stats.average_shipping_days <= 2 ? 'success' : 'warning'}
                    />
                    <StatBox
                        label="Disputas"
                        value={stats.disputes_count}
                        status={stats.disputes_count === 0 ? 'success' : 'error'}
                    />
                    <div className={`flex flex-col items-center justify-center rounded-2xl border p-2 ${stats.has_problems ? 'border-red-100 bg-red-50' : 'border-green-100 bg-white'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${stats.has_problems ? 'text-red-700' : 'text-green-700'}`}>Estado</span>
                        <div className={`mt-0.5 text-lg ${stats.has_problems ? 'text-red-600' : 'text-green-600'}`}>
                            {stats.has_problems ? '⚠️' : '✓'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MiniThermometer({ percent, label }: { percent: number; label: string }) {
    const pct = Math.max(0, Math.min(100, Math.round(percent)));
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</span>
                <span className="text-[10px] font-extrabold text-gray-900">{pct}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
                <div
                    className="absolute inset-0 transition-all duration-1000"
                    style={{
                        background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 35%, #22c55e 100%)',
                        width: '100%',
                    }}
                />
                <div
                    className="absolute inset-y-0 right-0 bg-gray-100 transition-all duration-1000"
                    style={{ width: `${100 - pct}%` }}
                />
                <div
                    className="absolute inset-y-0 w-0.5 bg-white shadow-sm"
                    style={{ left: `calc(${pct}% - 1px)` }}
                />
            </div>
        </div>
    );
}

function StatBox({ label, value, status }: { label: string; value: string | number; status: 'success' | 'warning' | 'error' }) {
    const colors = {
        success: 'text-green-600 bg-white border-green-100',
        warning: 'text-amber-600 bg-amber-50 border-amber-100',
        error: 'text-red-600 bg-red-50 border-red-100',
    };

    return (
        <div className={`flex flex-col items-center justify-center rounded-2xl border p-2 ${colors[status]}`}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <div className="mt-0.5 text-xs font-black">{value}</div>
        </div>
    );
}
