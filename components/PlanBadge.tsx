'use client';

import { Crown } from 'lucide-react';

interface PlatinumBadgeProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
}

/**
 * Insignia Platinum — se muestra junto al nombre del vendedor en listings,
 * perfil de tienda, cards de productos, etc.
 */
export function PlatinumBadge({ size = 'sm', showText = false, className = '' }: PlatinumBadgeProps) {
    const sizes = {
        sm: { icon: 'w-3.5 h-3.5', badge: 'px-1.5 py-0.5 text-[10px] gap-0.5' },
        md: { icon: 'w-4 h-4', badge: 'px-2 py-1 text-xs gap-1' },
        lg: { icon: 'w-5 h-5', badge: 'px-2.5 py-1.5 text-sm gap-1.5' },
    };

    const s = sizes[size];

    if (!showText) {
        return (
            <span
                className={`inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-white shadow-sm ${className}`}
                style={{ width: size === 'sm' ? 18 : size === 'md' ? 22 : 28, height: size === 'sm' ? 18 : size === 'md' ? 22 : 28 }}
                title="Vendedor Platinum ⭐"
            >
                <Crown className={s.icon} />
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-white font-bold shadow-sm ${s.badge} ${className}`}
            title="Vendedor Platinum ⭐"
        >
            <Crown className={s.icon} />
            PLATINUM
        </span>
    );
}

/**
 * Insignia Pro (Azul) — mantiene la insignia azul existente del plan Pro.
 */
export function ProBadge({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
    return (
        <span title="Vendedor Pro ✓">
            <svg
                className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} shrink-0 text-blue-500 ${className}`}
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                />
            </svg>
        </span>
    );
}

/**
 * Helper to show the correct badge based on plan type.
 */
export function PlanBadge({ plan, size = 'sm' }: { plan: string; size?: 'sm' | 'md' | 'lg' }) {
    if (plan === 'platinum') return <PlatinumBadge size={size} />;
    if (plan === 'pro') return <ProBadge size={size as 'sm' | 'md'} />;
    return null;
}
