'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useImpersonation } from './ImpersonationProvider';
import { supabase } from '@/lib/supabase/client';

function fmt(v: number) {
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function ImpersonationBanner() {
  const { isImpersonating, isLoading, targetUserId, targetData } = useImpersonation();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !isImpersonating || !targetUserId) return null;

  const profile = targetData?.profile;
  const wallet = targetData?.wallet;
  const userEmail = targetData?.user?.email;
  const displayName = profile?.full_name || profile?.nickname || userEmail || targetUserId.slice(0, 8);
  const avatarUrl = profile?.avatar_url;
  const balance = wallet?.balance != null ? Number(wallet.balance) : null;
  const sb = targetData?.seller_balance;

  const navLinks = [
    { href: '/dashboard', label: '🏠 Dashboard', title: 'Inicio' },
    { href: '/dashboard/compras', label: '📦 Compras', title: 'Mis Compras' },
    { href: '/dashboard/ventas', label: '🛍️ Ventas', title: 'Mis Ventas' },
    { href: '/dashboard/pagos', label: '💳 Pagos', title: 'Panel de Pagos' },
    { href: '/dashboard/monedero', label: '💰 Monedero', title: 'PocketCash' },
    { href: '/dashboard/disputas', label: '⚖️ Disputas', title: 'Disputas' },
    { href: '/dashboard/reputacion', label: '⭐ Reputación', title: 'Reputación' },
    { href: '/dashboard/preguntas', label: '💬 Preguntas', title: 'Preguntas' },
    { href: '/dashboard/favoritos', label: '❤️ Favoritos', title: 'Favoritos' },
    { href: '/dashboard/siguiendo', label: '👥 Siguiendo', title: 'Siguiendo' },
    { href: '/dashboard/coupons', label: '🎟️ Cupones', title: 'Cupones' },
    { href: '/dashboard/perfil', label: '👤 Perfil', title: 'Perfil' },
  ];

  return (
    <div className="fixed left-0 right-0 top-0 z-[90] flex flex-col" style={{ pointerEvents: 'none' }}>
      {/* Main Banner */}
      <div className="mx-auto mt-1.5 px-2 w-full max-w-5xl" style={{ pointerEvents: 'auto' }}>
        <div className="rounded-2xl bg-amber-900 shadow-xl shadow-amber-900/40 ring-1 ring-amber-500/60 overflow-hidden">
          {/* Top row */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Pulsing indicator */}
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full ring-2 ring-amber-400 object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-[13px] font-extrabold text-amber-950 ring-2 ring-amber-400">
                  👁️
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 ring-1 ring-amber-900 animate-pulse" />
            </div>

            {/* User info */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                🔍 Modo Espejo — Vista de Usuario
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-amber-50">{displayName}</span>
                {userEmail && displayName !== userEmail && (
                  <span className="text-[11px] text-amber-200/70">{userEmail}</span>
                )}
                {profile?.plan_type && (
                  <span className="rounded-full bg-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                    {profile.plan_type}
                  </span>
                )}
              </div>
              {/* Financial quick stats */}
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {balance !== null && (
                  <span className="text-[11px] text-green-300 font-semibold">
                    💰 PocketCash: {fmt(balance)}
                  </span>
                )}
                {sb && (
                  <>
                    {sb.disponible > 0 && (
                      <span className="text-[11px] text-blue-300 font-semibold">
                        ✅ Disponible: {fmt(sb.disponible)}
                      </span>
                    )}
                    {(sb.por_liberar + sb.estimado) > 0 && (
                      <span className="text-[11px] text-amber-300 font-semibold">
                        ⏳ Por liberar: {fmt(sb.por_liberar + sb.estimado)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setExpanded(p => !p)}
                className="rounded-xl bg-amber-700/60 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-700 transition-colors"
              >
                {expanded ? '▲ Ocultar' : '▼ Expandir'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { data: sess } = await supabase.auth.getSession();
                    const token = sess.session?.access_token;
                    const headers: HeadersInit = {};
                    if (token) headers.authorization = `Bearer ${token}`;
                    await fetch('/api/admin/impersonation/stop', { method: 'POST', headers });
                  } finally {
                    window.location.href = '/admin/usuarios';
                  }
                }}
                className="rounded-xl bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-400 transition-colors"
              >
                ✕ Salir
              </button>
            </div>
          </div>

          {/* Navigation Bar — always visible */}
          <div className="flex items-center gap-1 px-4 pb-2.5 flex-wrap">
            <span className="text-[10px] text-amber-400 font-semibold mr-1">IR A:</span>
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                title={link.title}
                className="rounded-lg bg-amber-800/60 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-700 transition-colors ring-1 ring-amber-600/40 hover:ring-amber-400/60"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Expanded financial panel */}
          {expanded && sb && (
            <div className="border-t border-amber-700/40 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-amber-950/40">
              <FinStat label="Disponible" value={fmt(sb.disponible)} color="text-green-300" />
              <FinStat label="Por liberar" value={fmt(sb.por_liberar)} color="text-blue-300" />
              <FinStat label="Estimado" value={fmt(sb.estimado)} color="text-amber-300" />
              <FinStat label="PocketCash" value={balance !== null ? fmt(balance) : '—'} color="text-emerald-300" />
              <FinStat label="Retirado total" value={fmt(sb.total_withdrawn)} color="text-purple-300" />
              <FinStat label="Comisiones" value={fmt(sb.total_commissions)} color="text-rose-300" />
            </div>
          )}

          {/* Expanded wallet transactions */}
          {expanded && targetData?.wallet_transactions && targetData.wallet_transactions.length > 0 && (
            <div className="border-t border-amber-700/40 px-4 py-3 bg-amber-950/40">
              <p className="text-[10px] font-bold uppercase text-amber-400 mb-2">Últimas transacciones PocketCash</p>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {targetData.wallet_transactions.slice(0, 10).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-200 truncate max-w-[60%]">{tx.concept || tx.reference_type || '—'}</span>
                    <span className={`font-bold ${tx.type === 'credit' ? 'text-green-300' : 'text-red-300'}`}>
                      {tx.type === 'credit' ? '+' : '-'}{fmt(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FinStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center bg-amber-900/40 rounded-xl px-2 py-2 ring-1 ring-amber-700/30">
      <span className="text-[9px] uppercase tracking-wider text-amber-400 font-bold mb-0.5">{label}</span>
      <span className={`text-sm font-extrabold ${color}`}>{value}</span>
    </div>
  );
}
