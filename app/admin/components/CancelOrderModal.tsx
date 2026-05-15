'use client';

import { useState, useMemo } from 'react';
import { Order } from '@/lib/types/domain.types';

type Props = {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CancelOrderModal({ order, isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [cancelledBy, setCancelledBy] = useState<'admin' | 'buyer' | 'seller'>('admin');
  const [chargeCommissionTo, setChargeCommissionTo] = useState<'none' | 'buyer' | 'seller'>('none');
  const [chargeShippingTo, setChargeShippingTo] = useState<'none' | 'buyer' | 'seller'>('none');
  const [reason, setReason] = useState('');

  // Costos estimados
  // Asumimos comisión 5% (o lo que tenga la orden si se guardó, pero usaremos un default si no)
  // Lo ideal sería que el backend calcule exacto, pero aquí hacemos una estimación para UI.
  // En este caso, usaremos los valores que el usuario decida como "Monto fijo" o porcentajes?
  // Mejor: El backend hace la lógica pesada. Aquí solo mostramos "Se descontará X" si tenemos el dato.
  // Pero no tenemos el dato de comisión exacta de la orden en el frontend a veces.
  // Vamos a simplificar: El admin decide A QUIEN se cobra.
  // Mostraremos alertas de qué pasará.
  
  // Si hay guía generada (shipping_label_url o status shipped/ready_to_ship), shipping cost es relevante.
  const hasShippingLabel = !!order.shipping_label_url || !!order.tracking_number;
  const shippingCost = Number(order.shipping_fee || 0); 
  const total = Number(order.total || 0);
  
  // Estimación de comisión (5% default, ajusta si tienes el dato real)
  const estimatedCommission = total * 0.05; 

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          cancelledBy,
          chargeCommissionTo,
          chargeShippingTo,
          reason
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cancelar la orden');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <h2 className="text-xl font-bold text-gray-900">Cancelar Orden</h2>
        <p className="text-sm text-gray-500">ID: {order.id}</p>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* Cancelado por */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Responsable / Solicitante</label>
            <select
              value={cancelledBy}
              onChange={(e) => setCancelledBy(e.target.value as any)}
              className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-emerald focus:ring-brand-emerald sm:text-sm"
            >
              <option value="admin">Administrador (Decisión de plataforma)</option>
              <option value="buyer">Comprador (Arrepentimiento/Error)</option>
              <option value="seller">Vendedor (Sin stock/No envió)</option>
            </select>
          </div>

          {/* Cobrar Comisión */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cobrar Comisión (~${estimatedCommission.toFixed(2)})
            </label>
            <div className="mt-1 text-xs text-gray-500 mb-2">
              La comisión se descontará del reembolso (si es al comprador) o del monedero (si es al vendedor).
            </div>
            <select
              value={chargeCommissionTo}
              onChange={(e) => setChargeCommissionTo(e.target.value as any)}
              className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-emerald focus:ring-brand-emerald sm:text-sm"
            >
              <option value="none">Nadie (Pocket absorbe / Anular)</option>
              <option value="buyer">Cobrar al Comprador (Descontar de reembolso)</option>
              <option value="seller">Cobrar al Vendedor (Descontar de monedero)</option>
            </select>
          </div>

          {/* Cobrar Envío */}
          {hasShippingLabel && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cobrar Envío (${shippingCost.toFixed(2)})
              </label>
              <div className="mt-1 text-xs text-gray-500 mb-2">
                Ya existe una guía generada. ¿Quién paga este costo?
              </div>
              <select
                value={chargeShippingTo}
                onChange={(e) => setChargeShippingTo(e.target.value as any)}
                className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-emerald focus:ring-brand-emerald sm:text-sm"
              >
                <option value="none">Nadie (Pocket absorbe)</option>
                <option value="buyer">Cobrar al Comprador (Descontar de reembolso)</option>
                <option value="seller">Cobrar al Vendedor (Descontar de monedero)</option>
              </select>
            </div>
          )}

          {/* Razón */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Motivo de cancelación</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-emerald focus:ring-brand-emerald sm:text-sm"
              placeholder="Explica la razón..."
            />
          </div>

          {/* Resumen */}
          <div className="rounded-xl bg-gray-50 p-4 text-sm">
            <h3 className="font-semibold text-gray-900">Resumen de Acción</h3>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-700">
              <li>La orden cambiará a estado <strong>Cancelado</strong>.</li>
              <li>
                El Comprador recibirá reembolso en <strong>PocketCash</strong>
                {chargeCommissionTo === 'buyer' ? ' MENOS la comisión' : ''}
                {chargeShippingTo === 'buyer' ? ' MENOS el envío' : ''}.
              </li>
              {chargeCommissionTo === 'seller' && (
                <li className="text-red-600">Al Vendedor se le cobrará la comisión de su monedero.</li>
              )}
              {chargeShippingTo === 'seller' && (
                <li className="text-red-600">Al Vendedor se le cobrará el envío de su monedero.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Confirmar Cancelación'}
          </button>
        </div>
      </div>
    </div>
  );
}
