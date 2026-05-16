'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { OrderChatFloating } from '@/components/OrderChatFloating';

export default function AdminOrderChatPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = String((params as any)?.orderId || '').trim();
  const [open, setOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Admin · Chat</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>Orden: {orderId ? `${orderId.slice(0, 8)}…` : '—'}</span>
                {orderId && (
                  <button
                    onClick={() => copyToClipboard(orderId, 'order')}
                    className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                    title="Copiar ID"
                  >
                    {copiedId === 'order' ? '✅' : '📋'}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/logistica" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Logística
            </Link>
            <Link href="/admin/soporte" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Soporte
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-sm text-gray-700">
            Este chat es el mismo que ven comprador y vendedor. Como admin puedes intervenir y mandar adjuntos.
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Abrir chat
          </button>
        </div>
      </main>

      <OrderChatFloating open={open} orderId={orderId || null} onClose={() => setOpen(false)} />
    </div>
  );
}

