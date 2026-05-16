'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type PaymentMethod = {
  id: string;
  method_type: string;
  details: Record<string, string>;
  is_active: boolean;
};

const AVAILABLE_METHODS = [
  { id: 'mercadopago', name: 'MercadoPago', logo: '/payment-logos/mercadopago.png', fields: [{ key: 'email_or_alias', label: 'Correo, Alias o CVU de MercadoPago' }] },
  { id: 'transferencia', name: 'Transferencia (SPEI)', logo: '/payment-logos/transferencia.png', fields: [{ key: 'clabe', label: 'CLABE Interbancaria' }, { key: 'bank', label: 'Banco' }, { key: 'name', label: 'Nombre del Beneficiario' }] },
  { id: 'oxxo', name: 'Depósito en Oxxo', logo: '/payment-logos/oxxo.png', fields: [{ key: 'card_number', label: 'Número de Tarjeta (16 dígitos)' }, { key: 'name', label: 'Nombre en la Tarjeta' }] },
  { id: 'deposito', name: 'Depósito Bancario', logo: '/payment-logos/deposito.png', fields: [{ key: 'account', label: 'Número de Cuenta' }, { key: 'bank', label: 'Banco' }, { key: 'name', label: 'Nombre del Beneficiario' }] },
  { id: 'paypal', name: 'PayPal', logo: null, fields: [{ key: 'email', label: 'Correo de PayPal' }] },
  { id: 'stripe', name: 'Stripe', logo: null, fields: [{ key: 'payment_link', label: 'Enlace de Pago (Stripe Payment Link)' }] },
  { id: 'otro', name: 'Otro Método', logo: null, fields: [{ key: 'description', label: 'Instrucciones detalladas de pago' }] },
];

export default function PaymentMethodsSettingsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('mercadopago');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      setUserId(uid);
      const { data } = await supabase
        .from('seller_payment_methods')
        .select('*')
        .eq('seller_id', uid)
        .order('created_at', { ascending: true });
      
      if (!cancelled) {
        setMethods(data || []);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('seller_payment_methods')
        .insert({
          seller_id: userId,
          method_type: selectedType,
          details: formData,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      setMethods([...methods, data]);
      setIsAdding(false);
      setFormData({});
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este método de pago?')) return;
    try {
      const { error } = await supabase.from('seller_payment_methods').delete().eq('id', id);
      if (error) throw error;
      setMethods(methods.filter(m => m.id !== id));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const currentMethodConfig = AVAILABLE_METHODS.find(m => m.id === selectedType);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm font-semibold text-brand-emerald hover:underline">
          &larr; Volver al Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-black text-gray-900">Métodos de Pago Directo</h1>
        <p className="mt-2 text-gray-600">
          Configura tus datos para recibir pagos directamente de los compradores. Estos métodos se mostrarán como una opción alternativa en el checkout, y los compradores subirán un comprobante de pago para que tú lo valides.
          <br/>
          <strong className="text-brand-emerald">Es obligatorio configurar al menos un método para poder publicar artículos.</strong>
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500">Cargando...</div>
      ) : (
        <div className="space-y-6">
          {methods.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {methods.map(method => {
                const conf = AVAILABLE_METHODS.find(m => m.id === method.method_type);
                return (
                  <div key={method.id} className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <button 
                      onClick={() => handleDelete(method.id)}
                      className="absolute right-4 top-4 text-gray-400 hover:text-red-500"
                      title="Eliminar"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-3">
                      {conf?.logo ? (
                        <img src={conf.logo} alt={conf.name} className="h-8 w-auto object-contain" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500">
                          {conf?.name?.[0] || 'O'}
                        </div>
                      )}
                      <h3 className="font-bold text-gray-900">{conf?.name || method.method_type}</h3>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      {Object.entries(method.details).map(([k, v]) => {
                        const label = conf?.fields.find(f => f.key === k)?.label || k;
                        return (
                          <div key={k}>
                            <span className="block text-[11px] font-bold uppercase text-gray-400">{label}</span>
                            <span className="font-medium text-gray-900">{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
              Aún no tienes ningún método de pago directo configurado. 
            </div>
          )}

          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="rounded-xl bg-brand-emerald px-6 py-3 text-sm font-bold text-white shadow hover:opacity-90 transition-opacity"
            >
              + Agregar Método de Pago
            </button>
          ) : (
            <form onSubmit={handleAdd} className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Método de Pago</h3>
              
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700">Tipo de método</label>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {AVAILABLE_METHODS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedType(m.id); setFormData({}); }}
                      className={`flex flex-col items-center justify-center rounded-xl border p-3 text-sm transition-all ${selectedType === m.id ? 'border-brand-emerald bg-emerald-50 ring-2 ring-brand-emerald/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                    >
                      {m.logo ? (
                        <img src={m.logo} alt={m.name} className="h-6 object-contain mb-2" />
                      ) : (
                        <span className="mb-2 block font-bold text-gray-500">{m.name[0]}</span>
                      )}
                      <span className="text-center text-xs font-semibold">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {currentMethodConfig && (
                <div className="mt-6 space-y-4">
                  {currentMethodConfig.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-semibold text-gray-700">{field.label}</label>
                      <input
                        type="text"
                        required
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-brand-emerald focus:ring-brand-emerald sm:text-sm"
                        placeholder={`Ingresa ${field.label.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-brand-emerald px-6 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Método'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
