'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function DeliveryFormatContent() {
  const searchParams = useSearchParams();
  const [date, setDate] = useState('');

  useEffect(() => {
    setDate(new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  const sellerName = searchParams.get('seller') || '______________________';
  const buyerName = searchParams.get('buyer') || '______________________';
  const orderId = searchParams.get('order') || '______________________';
  const items = searchParams.get('items') || 'Artículos de la orden';
  const total = searchParams.get('total') || '';

  return (
    <div className="min-h-screen bg-white p-8 text-black print:p-0">
      <div className="mx-auto max-w-2xl border-2 border-black p-8 print:border-0 print:p-0">
        <div className="mb-8 flex items-center justify-between border-b-2 border-black pb-4">
          <h1 className="text-3xl font-bold uppercase tracking-widest">GoVendy</h1>
          <div className="text-right">
            <h2 className="text-xl font-bold">CONSTANCIA DE ENTREGA</h2>
            <p className="text-sm text-gray-600">Entrega Personal</p>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex justify-between">
            <span className="font-bold">Fecha:</span>
            <span className="border-b border-black px-4">{date}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">ID de Orden:</span>
            <span className="border-b border-black px-4">{orderId}</span>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-300 p-4">
          <h3 className="mb-2 font-bold text-gray-900">Detalles de la Transacción</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-600">Vendedor (Entrega):</p>
              <p className="text-lg">{sellerName}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-600">Comprador (Recibe):</p>
              <p className="text-lg">{buyerName}</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="mb-2 font-bold text-gray-900">Artículos Entregados</h3>
          <div className="min-h-[100px] rounded-lg border border-gray-300 bg-gray-50 p-4">
            <p className="whitespace-pre-wrap">{items}</p>
            {total && <p className="mt-4 text-right font-bold">Total: {total}</p>}
          </div>
        </div>

        <div className="mb-12 space-y-2 text-justify text-sm text-gray-600">
          <p>
            Al firmar este documento, el <strong>Comprador</strong> declara haber recibido los artículos descritos anteriormente a su entera satisfacción y en las condiciones acordadas.
          </p>
          <p>
            Esta constancia sirve como evidencia de entrega para la liberación de fondos en la plataforma GoVendy.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-16">
          <div className="text-center">
            <div className="mb-2 border-b border-black pt-16"></div>
            <p className="font-bold">{sellerName}</p>
            <p className="text-xs text-gray-500">Firma del Vendedor</p>
          </div>
          <div className="text-center">
            <div className="mb-2 border-b border-black pt-16"></div>
            <p className="font-bold">{buyerName}</p>
            <p className="text-xs text-gray-500">Firma del Comprador</p>
          </div>
        </div>

        <div className="mt-12 text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-xl bg-black px-8 py-3 font-bold text-white shadow-lg hover:bg-gray-800"
          >
            Imprimir Formato
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Imprime este formato, llévalo a la entrega y pide al comprador que lo firme. Luego sube una foto en la sección "Ventas".
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeliveryFormatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando formato...</div>}>
      <DeliveryFormatContent />
    </Suspense>
  );
}
