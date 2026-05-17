'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type OrderRow = {
  id: string;
  total: number;
  status: string;
  seller_id: string;
  payment_method_type: string;
};

type PaymentMethod = {
  id: string;
  method_type: string;
  details: Record<string, string>;
};

const AVAILABLE_METHODS = [
  { id: 'mercadopago', name: 'MercadoPago', logo: '/payment-logos/mercadopago.png' },
  { id: 'transferencia', name: 'Transferencia (SPEI)', logo: '/payment-logos/transferencia.png' },
  { id: 'oxxo', name: 'Depósito en Oxxo', logo: '/payment-logos/oxxo.png' },
  { id: 'deposito', name: 'Depósito Bancario', logo: '/payment-logos/deposito.png' },
  { id: 'paypal', name: 'PayPal', logo: null },
  { id: 'stripe', name: 'Stripe', logo: null },
  { id: 'otro', name: 'Otro Método', logo: null },
];

export default function OrderPayPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const router = useRouter();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      try {
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('id, total, status, seller_id, payment_method_type')
          .eq('id', orderId)
          .single();
        
        if (orderErr) throw orderErr;
        setOrder(orderData);

        if (orderData.status !== 'awaiting_voucher') {
          // Si ya se pagó o está en otro estado, no debería estar aquí
          router.replace(`/dashboard/compras`);
          return;
        }

        const { data: methodsData, error: methodsErr } = await supabase
          .from('seller_payment_methods')
          .select('id, method_type, details')
          .eq('seller_id', orderData.seller_id)
          .eq('is_active', true);
        
        if (methodsErr) throw methodsErr;
        setMethods(methodsData || []);
        if (methodsData && methodsData.length > 0) {
          setSelectedMethodId(methodsData[0].id);
        }

      } catch (err: any) {
        setError(err.message || 'Error al cargar la orden.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVoucherFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!voucherFile || !selectedMethodId || !order) return;
    setUploading(true);
    setError(null);
    try {
      const selectedMethod = methods.find(m => m.id === selectedMethodId);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const formData = new FormData();
      formData.append('file', voucherFile);
      formData.append('folder', 'vouchers');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Error al subir el comprobante');

      const voucherUrl = uploadData.url;

      // Update order
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          status: 'verifying_payment',
          buyer_payment_voucher_url: voucherUrl,
          seller_payment_details: selectedMethod?.details || {},
        })
        .eq('id', order.id);

      if (updateErr) throw updateErr;

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/compras');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Error al subir el comprobante.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;
  if (!order) return <div className="p-10 text-center text-gray-500">Orden no encontrada.</div>;

  if (success) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">¡Comprobante enviado!</h2>
        <p className="mt-2 text-gray-600">El vendedor verificará tu pago. Serás redirigido a tus compras...</p>
      </div>
    );
  }

  const selectedMethod = methods.find(m => m.id === selectedMethodId);
  const selectedConfig = selectedMethod ? AVAILABLE_METHODS.find(m => m.id === selectedMethod.method_type) : null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <Link href="/dashboard/compras" className="text-sm font-semibold text-brand-emerald hover:underline">
          &larr; Volver a Mis Compras
        </Link>
        <h1 className="mt-4 text-3xl font-black text-gray-900">Pago Directo al Vendedor</h1>
        <p className="mt-2 text-gray-600">
          Por favor, realiza el pago por la cantidad exacta de <strong className="text-gray-900">${order.total.toFixed(2)} MXN</strong> usando uno de los métodos disponibles del vendedor.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Métodos disponibles</h2>
          {methods.length === 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Este vendedor no tiene métodos de pago configurados. Por favor contáctalo en el chat de la orden.
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map(m => {
                const conf = AVAILABLE_METHODS.find(x => x.id === m.method_type);
                return (
                  <label
                    key={m.id}
                    className={`block cursor-pointer rounded-2xl border p-4 transition ${selectedMethodId === m.id ? 'border-brand-emerald bg-emerald-50 ring-1 ring-brand-emerald' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="method" 
                        checked={selectedMethodId === m.id} 
                        onChange={() => setSelectedMethodId(m.id)}
                        className="text-brand-emerald focus:ring-brand-emerald"
                      />
                      {conf?.logo && <img src={conf.logo} alt={conf.name} className="h-6 w-auto object-contain" />}
                      <span className="font-semibold text-gray-900">{conf?.name || m.method_type}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {selectedMethod && selectedConfig && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 mt-4">
              <h3 className="font-bold text-gray-900 mb-3">Datos de pago:</h3>
              <div className="space-y-2 text-sm text-gray-700">
                {Object.entries(selectedMethod.details).map(([k, v]) => (
                  <div key={k}>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">{k}</span>
                    <span className="font-mono text-base font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Comprobante de Pago</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm text-gray-600">
              Una vez que hayas realizado el pago, sube la foto o captura de pantalla del comprobante aquí para que el vendedor pueda verificarlo.
            </p>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-emerald hover:file:bg-emerald-100"
            />
            {voucherFile && (
              <div className="mt-4 text-sm text-green-700 font-medium flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Archivo seleccionado: {voucherFile.name}
              </div>
            )}
            
            <button
              onClick={handleUpload}
              disabled={!voucherFile || uploading || methods.length === 0}
              className="mt-6 w-full rounded-xl bg-brand-emerald px-4 py-3 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : 'Enviar Comprobante'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
