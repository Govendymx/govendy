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
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'platinum'>('pro');
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

  const simulatePayment = async () => {
    setPaymentStep('processing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch('/api/user/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al procesar el pago');
      }

      setPaymentStep('success');
      setTimeout(() => {
        setPlan(selectedPlan);
        setShowPaymentModal(false);
        setPaymentStep('idle');
        router.refresh();
        window.location.reload();
      }, 2000);
    } catch (err) {
      alert('Error al procesar: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      setPaymentStep('idle');
    }
  };

  const handleSwitch = async (newPlan: string) => {
    if (newPlan === plan) return;

    if (newPlan === 'pro' || newPlan === 'platinum') {
      setSelectedPlan(newPlan as 'pro' | 'platinum');
      setShowPaymentModal(true);
      return;
    }

    if (!confirm(`¿Estás seguro que deseas cambiar al plan ${newPlan.toUpperCase()}? Perderás tus beneficios actuales.`)) return;

    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/user/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: newPlan }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al actualizar el plan');
      }

      setPlan(newPlan);
      router.refresh();
      window.location.reload();
    } catch (err) {
      alert('Error al cambiar de plan: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      console.error(err);
    } finally {
      setUpdating(false);
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
            disabled={plan === 'pro' || updating}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${plan === 'pro'
              ? 'bg-emerald-100 text-brand-emerald cursor-default border-2 border-brand-emerald/20'
              : 'bg-brand-emerald text-white hover:bg-emerald-600 shadow-md hover:shadow-lg'
              }`}
          >
            {plan === 'pro' ? '✓ Tu plan actual' : currentPlanIndex > 1 ? 'Cambiar a PRO' : 'Obtener Plan PRO'}
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
            disabled={plan === 'platinum' || updating}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${plan === 'platinum'
              ? 'bg-amber-100 text-amber-700 cursor-default border-2 border-amber-300'
              : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600 shadow-md hover:shadow-lg'
              }`}
          >
            {plan === 'platinum' ? '⭐ Tu plan actual' : 'Obtener Plan Platinum'}
          </button>
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
                    Suscripción {selectedPlan === 'platinum' ? 'Platinum ⭐' : 'PRO'}
                  </h3>
                  <button onClick={() => setShowPaymentModal(false)} className="rounded-full p-1 hover:bg-gray-100">
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="mb-6 space-y-4">
                  <div className={`rounded-xl p-4 border ${selectedPlan === 'platinum' ? 'bg-amber-50 border-amber-200' : 'bg-white border-emerald-100'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-900">
                        Plan {selectedPlan === 'platinum' ? 'Platinum' : 'PRO'} Mensual
                      </span>
                      <span className={`font-bold ${selectedPlan === 'platinum' ? 'text-amber-600' : 'text-brand-emerald'}`}>
                        ${prices[selectedPlan].toLocaleString('es-MX')}.00 MXN
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Acceso completo por 30 días.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-brand-emerald transition-colors">
                      <input type="radio" name="payment" defaultChecked className="text-brand-emerald focus:ring-brand-emerald" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Tarjeta de Crédito/Débito</div>
                        <div className="text-xs text-gray-500">Procesado seguro por MercadoPago</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-brand-emerald transition-colors">
                      <input type="radio" name="payment" className="text-brand-emerald focus:ring-brand-emerald" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">PocketCash</div>
                        <div className="text-xs text-gray-500">Paga con tu saldo disponible</div>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  onClick={simulatePayment}
                  className={`w-full rounded-xl py-3.5 text-center font-bold text-white shadow-lg transition-all active:scale-[0.98] ${selectedPlan === 'platinum'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-amber-200 hover:from-amber-600 hover:to-yellow-600'
                    : 'bg-brand-emerald shadow-emerald-200 hover:bg-emerald-600'
                    }`}
                >
                  Pagar ${prices[selectedPlan].toLocaleString('es-MX')}.00 y Activar
                </button>
                <p className="mt-3 text-center text-xs text-gray-400">
                  Transacción segura encriptada de extremo a extremo.
                </p>
              </>
            )}

            {paymentStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className={`h-12 w-12 animate-spin rounded-full border-4 border-t-transparent mb-4 ${selectedPlan === 'platinum' ? 'border-amber-500' : 'border-brand-emerald'
                  }`}></div>
                <h3 className="text-lg font-bold text-gray-900">Procesando pago...</h3>
                <p className="text-sm text-gray-500">No cierres esta ventana.</p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {selectedPlan === 'platinum' ? '⭐ ¡Bienvenido a Platinum!' : '¡Bienvenido a PRO!'}
                </h3>
                <p className="mt-2 text-gray-600">Tu suscripción ha sido activada correctamente.</p>
                {selectedPlan === 'platinum' && (
                  <p className="mt-2 text-amber-600 font-semibold">📹 Ya puedes usar GoVendy Live</p>
                )}
                <p className="mt-4 text-sm text-gray-400">Redirigiendo...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}