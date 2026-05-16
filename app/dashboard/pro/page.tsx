'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Check, X, Info, Crown, Zap, Shield } from 'lucide-react';
import { PLAN_LIMITS } from '@/lib/plans/limits';

export default function ProPage() {
  const [plan, setPlan] = useState<string>('basic');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [dates, setDates] = useState<{ start: string; end: string } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'platinum' | 'verification'>('pro');
  const [contactPref, setContactPref] = useState('whatsapp');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'processing' | 'success'>('idle');
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('plan_type, pro_subscription_start, pro_subscription_end')
        .eq('id', user.id)
        .single();
      if (data) {
        setPlan(data.plan_type || 'basic');
        if (data.pro_subscription_start && data.pro_subscription_end) {
          setDates({ start: data.pro_subscription_start, end: data.pro_subscription_end });
        }
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const submitRequest = async () => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch('/api/user/request-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: selectedPlan, contact_preference: contactPref }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al enviar la solicitud');
      }

      setPaymentStep('success');
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      setPaymentStep('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitch = async (newPlan: string) => {
    if (newPlan === plan && newPlan !== 'verification') return;

    if (newPlan === 'pro' || newPlan === 'platinum' || newPlan === 'verification') {
      setSelectedPlan(newPlan as 'pro' | 'platinum' | 'verification');
      setShowPaymentModal(true);
      setPaymentStep('idle');
      return;
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando información de tu plan...</div>;

  const planOrder = ['basic', 'pro', 'platinum'];
  const currentPlanIndex = planOrder.indexOf(plan);
  const prices = { basic: 0, pro: 699, platinum: 999 };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Planes y Suscripciones</h1>
        <p className="text-gray-600 text-lg">Elige el plan que mejor se adapte a tus necesidades y desbloquea todo tu potencial.</p>
      </div>

      {/* Expiration Warning */}
      {(plan === 'pro' || plan === 'platinum') && dates?.end && (() => {
        const daysLeft = Math.ceil((new Date(dates.end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 5 && daysLeft > 0) {
          return (
            <div className="mb-8 flex items-start gap-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 shadow-sm">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div>
                <h3 className="font-bold text-yellow-900">Tu suscripción {plan.toUpperCase()} vence pronto</h3>
                <p className="text-sm">
                  Te quedan <strong>{daysLeft} días</strong> de beneficios. Renueva ahora para evitar interrupciones.
                </p>
              </div>
              <button
                onClick={() => { setSelectedPlan(plan as any); setShowPaymentModal(true); }}
                className="ml-auto shrink-0 whitespace-nowrap rounded-lg bg-yellow-100 px-3 py-1.5 text-xs font-bold text-yellow-800 hover:bg-yellow-200"
              >
                Renovar Ahora
              </button>
            </div>
          );
        }
        if (daysLeft <= 0) {
          return (
            <div className="mb-8 flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h3 className="font-bold text-red-900">Tu suscripción ha vencido</h3>
                <p className="text-sm">Tus beneficios están pausados. Renueva para continuar.</p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="grid md:grid-cols-3 gap-6 items-start">

        {/* Plan Básico */}
        <div className={`rounded-3xl border-2 bg-white p-8 relative hover:shadow-lg transition-all ${plan === 'basic' ? 'border-gray-900 shadow-lg' : 'border-gray-200'}`}>
          {plan === 'basic' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-gray-900 text-white text-xs font-bold px-4 py-1 rounded-full">
              Plan Actual
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-6 h-6 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">Básico</h2>
          </div>

          <div className="flex items-baseline">
            <span className="text-4xl font-extrabold text-gray-900">$0</span>
            <span className="ml-1 text-lg text-gray-500">/ mes</span>
          </div>
          <p className="text-green-600 font-bold mt-1 text-sm uppercase tracking-wide">GRATIS SIEMPRE</p>

          <ul className="mt-6 space-y-3 text-sm text-gray-600 mb-6">
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 font-bold text-xs">{PLAN_LIMITS.basic.auctions}</span>
              <span><strong>Subastas</strong> al mes</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 font-bold text-xs">{PLAN_LIMITS.basic.listings}</span>
              <span><strong>Publicaciones</strong> al mes</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 font-bold text-xs">{PLAN_LIMITS.basic.coupons}</span>
              <span><strong>Cupones</strong> al mes</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 text-gray-600 font-bold text-xs">{PLAN_LIMITS.basic.featured}</span>
              <span><strong>Destacados</strong> activos</span>
            </li>

            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0" />
              <span>Envíos con guías GoVendy</span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-400">
              <X className="w-5 h-5 shrink-0" />
              <span>Envíos gestionados por vendedor</span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-400">
              <X className="w-5 h-5 shrink-0" />
              <span>Entregas personales</span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-400">
              <X className="w-5 h-5 shrink-0" />
              <span>GoVendy Live</span>
            </li>

            <li className="flex items-center gap-2.5 text-gray-600">
              <span className="w-5 h-5 shrink-0 text-center">📅</span>
              <span>Retiros <strong>semanales</strong></span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-600">
              <span className="w-5 h-5 shrink-0 text-center">💰</span>
              <span>Comisión del <strong>{PLAN_LIMITS.basic.commission_percent}%</strong></span>
            </li>
          </ul>

          <button
            onClick={() => handleSwitch('basic')}
            disabled={plan === 'basic' || updating}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${plan === 'basic'
              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-default'
              : 'bg-white border-gray-900 text-gray-900 hover:bg-gray-50'
              }`}
          >
            {plan === 'basic' ? '✓ Plan Actual' : 'Cambiar a Básico'}
          </button>
        </div>

        {/* Plan PRO */}
        <div className={`rounded-3xl border-2 bg-white p-8 relative hover:shadow-xl transition-all ${plan === 'pro' ? 'border-brand-emerald shadow-xl ring-2 ring-brand-emerald/20' : 'border-brand-emerald/30'}`}>
          {plan === 'pro' ? (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-brand-emerald text-white text-xs font-bold px-4 py-1 rounded-full flex flex-col items-center">
              <span>Plan Actual</span>
              {dates?.end && (
                <span className="text-[9px] opacity-80 normal-case font-normal">
                  Vence: {new Date(dates.end).toLocaleDateString('es-MX')}
                </span>
              )}
            </div>
          ) : (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-brand-emerald text-white text-xs font-bold px-4 py-1 rounded-full">
              Popular
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-6 h-6 text-brand-emerald" />
            <h2 className="text-2xl font-bold text-gray-900">PRO</h2>
          </div>

          <div className="flex items-baseline">
            <span className="text-4xl font-extrabold text-gray-900">$699</span>
            <span className="ml-1 text-lg text-gray-500">/ mes</span>
          </div>
          <p className="text-brand-emerald font-bold mt-1 text-sm uppercase tracking-wide">GRATIS (TIEMPO LIMITADO)</p>

          <ul className="mt-6 space-y-3 text-sm text-gray-600 mb-6">
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-brand-emerald text-white font-bold text-xs">∞</span>
              <span>Subastas <strong>ILIMITADAS</strong></span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-brand-emerald text-white font-bold text-xs">∞</span>
              <span>Publicaciones <strong>ILIMITADAS</strong></span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-brand-emerald text-white font-bold text-xs">∞</span>
              <span>Cupones <strong>ILIMITADOS</strong></span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-brand-emerald/10 text-brand-emerald font-bold text-xs">{PLAN_LIMITS.pro.featured}</span>
              <span><strong>Destacados</strong> activos</span>
            </li>

            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0" />
              <span>Envíos con guías GoVendy</span>
            </li>
            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-brand-emerald" />
              <span><strong>Envíos gestionados por vendedor</strong></span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-400">
              <X className="w-5 h-5 shrink-0" />
              <span>Entregas personales</span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-400">
              <X className="w-5 h-5 shrink-0" />
              <span>GoVendy Live</span>
            </li>

            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-brand-emerald" />
              <span>Logo en tu tienda</span>
            </li>
            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-blue-500" />
              <span>Insignia <strong>Azul</strong> ✓</span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-600">
              <span className="w-5 h-5 shrink-0 text-center">⚡</span>
              <span>Retiros en <strong>48 horas</strong></span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-600">
              <span className="w-5 h-5 shrink-0 text-center">💰</span>
              <span>Comisión del <strong>{PLAN_LIMITS.pro.commission_percent}%</strong></span>
            </li>
          </ul>

          <button
            onClick={() => handleSwitch('pro')}
            disabled={plan === 'pro'}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${plan === 'pro'
              ? 'bg-emerald-100 text-brand-emerald cursor-default border-2 border-brand-emerald/20'
              : 'bg-brand-emerald text-white hover:bg-emerald-600 shadow-md hover:shadow-lg'
              }`}
          >
            {plan === 'pro' ? '✓ Tu plan actual' : currentPlanIndex > 1 ? 'Activar PRO (Contactar Soporte)' : 'Obtener Plan PRO'}
          </button>
        </div>

        {/* Plan PLATINUM */}
        <div className={`rounded-3xl border-2 bg-gradient-to-b from-white to-amber-50/50 p-8 relative hover:shadow-xl transition-all ${plan === 'platinum' ? 'border-amber-500 shadow-xl ring-2 ring-amber-400/30' : 'border-amber-300'}`}>
          {plan === 'platinum' ? (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold px-4 py-1 rounded-full flex flex-col items-center shadow-lg">
              <span>⭐ Plan Actual</span>
              {dates?.end && (
                <span className="text-[9px] opacity-80 normal-case font-normal">
                  Vence: {new Date(dates.end).toLocaleDateString('es-MX')}
                </span>
              )}
            </div>
          ) : (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
              ⭐ Premium
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-900">Platinum</h2>
          </div>

          <div className="flex items-baseline">
            <span className="text-4xl font-extrabold text-gray-900">$999</span>
            <span className="ml-1 text-lg text-gray-500">/ mes</span>
          </div>
          <p className="text-amber-600 font-bold mt-1 text-sm uppercase tracking-wide">GRATIS (TIEMPO LIMITADO)</p>

          <ul className="mt-6 space-y-3 text-sm text-gray-600 mb-6">
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs">∞</span>
              <span><strong>TODO</strong> ilimitado</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs">∞</span>
              <span>Destacados <strong>ILIMITADOS</strong></span>
            </li>

            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0" />
              <span>Envíos con guías GoVendy</span>
            </li>
            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-amber-500" />
              <span><strong>Envíos gestionados por vendedor</strong></span>
            </li>
            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-amber-500" />
              <span><strong>Entregas personales</strong></span>
            </li>

            {/* LIVE - Exclusive */}
            <li className="flex items-center gap-2.5 text-amber-700 bg-amber-50 rounded-lg py-1.5 px-2 -mx-2 ring-1 ring-amber-200">
              <span className="text-lg">📹</span>
              <span className="font-bold">GoVendy Live</span>
              <span className="ml-auto text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">EXCLUSIVO</span>
            </li>

            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-amber-500" />
              <span>Logo + Insignia <strong>Dorada</strong> ⭐</span>
            </li>
            <li className="flex items-center gap-2.5 text-green-600">
              <Check className="w-5 h-5 shrink-0 text-amber-500" />
              <span>Soporte <strong>prioritario</strong></span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-600">
              <span className="w-5 h-5 shrink-0 text-center">⚡</span>
              <span>Retiros en <strong>24 horas</strong></span>
            </li>
            <li className="flex items-center gap-2.5 text-gray-600">
              <span className="w-5 h-5 shrink-0 text-center">💰</span>
              <span>Comisión del <strong>{PLAN_LIMITS.platinum.commission_percent}%</strong></span>
            </li>
          </ul>

          <button
            onClick={() => handleSwitch('platinum')}
            disabled={plan === 'platinum'}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${plan === 'platinum'
              ? 'bg-amber-100 text-amber-700 cursor-default border-2 border-amber-300'
              : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600 shadow-md hover:shadow-lg'
              }`}
          >
            {plan === 'platinum' ? '⭐ Tu plan actual' : 'Obtener Plan Platinum'}
          </button>
        </div>
      </div>

      {/* Verificación de Insignia Azul */}
      <div className="mt-12 mb-8 bg-blue-50 border border-blue-200 rounded-3xl p-8 max-w-4xl mx-auto shadow-sm hover:shadow-md transition-all">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-6 h-6 text-blue-600 bg-blue-100 rounded-full p-1" />
              <h2 className="text-2xl font-bold text-blue-900">Insignia Azul Oficial</h2>
            </div>
            <p className="text-blue-800 font-medium mb-4">Aumenta tus ventas generando máxima confianza en tus compradores.</p>
            <ul className="space-y-3 text-sm text-blue-900 mb-6">
              <li className="flex items-center gap-2.5">
                <Check className="w-5 h-5 shrink-0 text-blue-600" />
                <span>Verificación de <strong>identidad</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-5 h-5 shrink-0 text-blue-600" />
                <span>Verificación de <strong>Domicilio</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-5 h-5 shrink-0 text-blue-600" />
                <span>Videollamada con un <strong>ejecutivo</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-5 h-5 shrink-0 text-blue-600" />
                <span>Solicitud de <strong>Datos y documentos de Identidad</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-5 h-5 shrink-0 text-blue-600" />
                <span>Incluye envío de <strong>verificación</strong></span>
              </li>
            </ul>
          </div>
          <div className="w-full md:w-auto flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-blue-100 shadow-sm shrink-0">
            <div className="text-3xl font-extrabold text-gray-900 mb-1">$750.00</div>
            <div className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-6">ANUAL</div>
            <button
              onClick={() => handleSwitch('verification')}
              className="w-full py-3 px-6 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
            >
              Iniciar tu proceso
            </button>
          </div>
        </div>
      </div>

      {/* Comparison note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Todos los planes incluyen protección al comprador, sistema de reputación y soporte vía chat.
        </p>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {paymentStep === 'idle' && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedPlan === 'platinum' ? 'Activar Platinum ⭐' : selectedPlan === 'pro' ? 'Activar PRO' : 'Solicitar Verificación'}
                  </h3>
                  <button onClick={() => setShowPaymentModal(false)} className="rounded-full p-1 hover:bg-gray-100">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="mb-6 space-y-4">
                  <div className={`rounded-xl p-4 border ${selectedPlan === 'platinum' ? 'bg-amber-50 border-amber-200' : selectedPlan === 'verification' ? 'bg-blue-50 border-blue-200' : 'bg-white border-emerald-100'}`}>
                    <div className="flex flex-col gap-2 mb-2 text-center">
                      <span className="font-semibold text-gray-900 text-lg">
                        {selectedPlan === 'verification' ? '¡Inicia tu proceso de verificación!' : '¡Estás a un paso de mejorar tu cuenta!'}
                      </span>
                      <p className="text-sm text-gray-600">
                        {selectedPlan === 'verification' 
                          ? 'Envía tu solicitud y un ejecutivo se pondrá en contacto contigo para comenzar el trámite de la Insignia Azul.'
                          : `Para activar tu plan <strong>${selectedPlan === 'platinum' ? 'Platinum' : 'PRO'}</strong> y recibir los datos de pago, por favor envía tu solicitud.`
                        }
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferencia de contacto</label>
                    <select
                      value={contactPref}
                      onChange={(e) => setContactPref(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald bg-white"
                    >
                      <option value="whatsapp">Contactarme por WhatsApp</option>
                      <option value="phone">Llamada telefónica</option>
                      <option value="email">Por Correo Electrónico</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={submitRequest}
                  disabled={isSubmitting}
                  className={`flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-center font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 ${selectedPlan === 'platinum'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-amber-200 hover:from-amber-600 hover:to-yellow-600'
                    : selectedPlan === 'verification'
                      ? 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'
                      : 'bg-brand-emerald shadow-emerald-200 hover:bg-emerald-600'
                    }`}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="mt-3 w-full rounded-xl py-3.5 text-center font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all active:scale-[0.98]"
                >
                  Cancelar
                </button>
              </>
            )}

            {paymentStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  ¡Solicitud Enviada!
                </h3>
                <p className="mt-2 text-gray-600">Hemos recibido tu solicitud correctamente.</p>
                <p className="mt-2 text-sm text-gray-500">Un miembro de nuestro equipo se pondrá en contacto contigo a la brevedad posible.</p>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="mt-6 w-full rounded-xl py-3 text-center font-bold text-white bg-brand-emerald hover:bg-emerald-600 transition-all active:scale-[0.98]"
                >
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}