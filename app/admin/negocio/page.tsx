'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type PaymentMethodsConfig = any;

export default function AdminNegocioPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsConfig>({ mercadopago: { enabled: true } });
  const [mpBaseAccount, setMpBaseAccount] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  const [carrierEstafeta, setCarrierEstafeta] = useState('180');
  const [carrierFedex, setCarrierFedex] = useState('0');
  const [carrierDhl, setCarrierDhl] = useState('0');
  const [extendedExtra, setExtendedExtra] = useState('200');

  // Commissions
  const [commissionBasic, setCommissionBasic] = useState('23');
  const [commissionPro, setCommissionPro] = useState('18');
  const [commissionPlatinum, setCommissionPlatinum] = useState('18');

  // Cashback Global
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState('0');
  const [cashbackStartDate, setCashbackStartDate] = useState('');
  const [cashbackEndDate, setCashbackEndDate] = useState('');

  // Tax Withholding
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxIsrRate, setTaxIsrRate] = useState('1.00');
  const [taxIsrNoRfcRate, setTaxIsrNoRfcRate] = useState('20.00');
  const [taxIvaRate, setTaxIvaRate] = useState('8.00');

  const computed = useMemo(() => {
    const n = (v: string) => {
      const x = Number(v ?? 0);
      return Number.isFinite(x) ? x : 0;
    };
    return {
      estafeta: n(carrierEstafeta),
      fedex: n(carrierFedex),
      dhl: n(carrierDhl),
      extended: n(extendedExtra),
      commBasic: n(commissionBasic),
      commPro: n(commissionPro),
      commPlatinum: n(commissionPlatinum),
      cbPercent: n(cashbackPercent),
    };
  }, [carrierDhl, carrierEstafeta, carrierFedex, extendedExtra, commissionBasic, commissionPro, commissionPlatinum, cashbackPercent]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        setSuccess(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/login?returnTo=/admin/negocio';
          return;
        }

        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
        if (!adminRow) {
          setError('No tienes permisos de administrador para ver esta página.');
          return;
        }

        const { data: settingsRow, error: sErr } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        if (sErr) throw sErr;

        const pm = (settingsRow as any)?.payment_methods ?? { mercadopago: { enabled: true } };
        setPaymentMethods(pm);

        const baseAccount = String(pm?.mercadopago?.base_account ?? '').trim();
        setMpBaseAccount(baseAccount);

        setCarrierEstafeta(String((settingsRow as any)?.shipping_base ?? 180));
        setExtendedExtra(String((settingsRow as any)?.shipping_extended ?? 200));

        const carriers = (pm?.shipping_carriers ?? {}) as any;
        setCarrierFedex(String(carriers?.fedex?.base ?? 0));
        setCarrierDhl(String(carriers?.dhl?.base ?? 0));

        // Commissions
        setCommissionBasic(String((settingsRow as any)?.commission_basic_percent ?? 23));
        setCommissionPro(String((settingsRow as any)?.commission_pro_percent ?? 18));
        setCommissionPlatinum(String((settingsRow as any)?.commission_platinum_percent ?? 18));

        // Cashback
        setCashbackEnabled(Boolean((settingsRow as any)?.cashback_enabled));
        setCashbackPercent(String((settingsRow as any)?.cashback_percent ?? 0));
        setCashbackStartDate((settingsRow as any)?.cashback_start_date ? String((settingsRow as any).cashback_start_date).split('T')[0] : '');
        setCashbackEndDate((settingsRow as any)?.cashback_end_date ? String((settingsRow as any).cashback_end_date).split('T')[0] : '');

        // Tax Withholding
        setTaxEnabled(Boolean((settingsRow as any)?.tax_withholding_enabled));
        setTaxIsrRate(String((settingsRow as any)?.tax_isr_rate ?? '1.00'));
        setTaxIsrNoRfcRate(String((settingsRow as any)?.tax_isr_no_rfc_rate ?? '20.00'));
        setTaxIvaRate(String((settingsRow as any)?.tax_iva_rate ?? '8.00'));

      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar Negocio.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const pmNext: any = { ...(paymentMethods ?? {}) };
      pmNext.mercadopago = { ...(pmNext.mercadopago ?? {}), base_account: mpBaseAccount.trim() };
      pmNext.shipping_carriers = {
        ...(pmNext.shipping_carriers ?? {}),
        estafeta: { base: computed.estafeta },
        fedex: { base: computed.fedex },
        dhl: { base: computed.dhl },
      };

      const payload: any = {
        payment_methods: pmNext,
        shipping_base: computed.estafeta,
        shipping_extended: computed.extended,

        // Commissions
        commission_basic_percent: computed.commBasic,
        commission_pro_percent: computed.commPro,
        commission_platinum_percent: computed.commPlatinum,

        // Cashback
        cashback_enabled: cashbackEnabled,
        cashback_percent: computed.cbPercent,
        cashback_start_date: cashbackStartDate ? new Date(cashbackStartDate).toISOString() : null,
        cashback_end_date: cashbackEndDate ? new Date(cashbackEndDate).toISOString() : null,

        // Tax Withholding
        tax_withholding_enabled: taxEnabled,
        tax_isr_rate: Number(taxIsrRate) || 1.00,
        tax_isr_no_rfc_rate: Number(taxIsrNoRfcRate) || 20.00,
        tax_iva_rate: Number(taxIvaRate) || 8.00,

        updated_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase.from('app_settings').update(payload).eq('id', 1);
      if (updErr) throw updErr;
      setSuccess('Configuración de Negocio guardada.');
      setPaymentMethods(pmNext);
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as any)?.message || (e as any)?.details || (e as any)?.hint || JSON.stringify(e);
      if (msg.includes('Could not find the')) {
        setError('Error de base de datos: Faltan columnas en la tabla app_settings. Por favor ejecuta el script SQL de migración "MIGRACION_NEGOCIO_CASHBACK_COMISIONES.sql".');
      } else {
        setError(`Error al guardar: ${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isBooting) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="h-6 w-40 rounded-xl bg-white/70 ring-1 ring-black/5" />
        <div className="mt-6 h-40 rounded-3xl bg-white/70 ring-1 ring-black/5" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-gray-900">Admin · Negocio</div>
          <div className="mt-1 text-sm text-gray-600">Configura cuenta base de MercadoPago y costos de envíos.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Configuración (general)
          </Link>
        </div>
      </div>

      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {success ? <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-bold text-gray-900">MercadoPago (cuenta base)</div>
          <div className="mt-2 text-sm text-gray-600">
            Aquí defines la cuenta base donde se resguardan fondos (referencia interna: alias/email/ID).
          </div>
          <div className="relative mt-3">
            <input
              value={mpBaseAccount}
              onChange={(e) => setMpBaseAccount(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="Ej: cuenta_base@correo.com o alias"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(mpBaseAccount, 'mpBaseAccount')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-orange focus:outline-none"
              title="Copiar cuenta base"
            >
              {copiedId === 'mpBaseAccount' ? '✅' : '📋'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-bold text-gray-900">Envíos</div>
          <div className="mt-2 text-sm text-gray-600">Configura costos base por paquetería (5 kg) y zona extendida.</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Estafeta (base)</label>
              <input
                value={carrierEstafeta}
                onChange={(e) => setCarrierEstafeta(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">FedEx (base)</label>
              <input
                value={carrierFedex}
                onChange={(e) => setCarrierFedex(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">DHL (base)</label>
              <input
                value={carrierDhl}
                onChange={(e) => setCarrierDhl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Zona extendida (extra)</label>
              <input
                value={extendedExtra}
                onChange={(e) => setExtendedExtra(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Para detectar “zona extendida” por CP (DHL/FedEx/Estafeta) hace falta una tabla de códigos postales extendidos. Te la dejo como siguiente paso.
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-bold text-gray-900">Comisiones de Venta</div>
          <div className="mt-2 text-sm text-gray-600">Porcentaje que retiene la plataforma por cada venta.</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-700">Plan Básico (%)</label>
              <div className="relative mt-1">
                <input
                  value={commissionBasic}
                  onChange={(e) => setCommissionBasic(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  inputMode="numeric"
                  placeholder="23"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Plan PRO (%)</label>
              <div className="relative mt-1">
                <input
                  value={commissionPro}
                  onChange={(e) => setCommissionPro(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  inputMode="numeric"
                  placeholder="18"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-purple-700 flex items-center gap-1">Plan Platinum (%) <span className="text-[10px] font-bold rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.5">✦ Platinum</span></label>
              <div className="relative mt-1">
                <input
                  value={commissionPlatinum}
                  onChange={(e) => setCommissionPlatinum(e.target.value)}
                  className="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                  inputMode="numeric"
                  placeholder="18"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs">%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Cashback Global</div>
              <div className="mt-1 text-xs text-gray-600">Bonificación para compradores en TODAS las ventas.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${cashbackEnabled ? 'text-brand-orange' : 'text-gray-400'}`}>
                {cashbackEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
              </span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={cashbackEnabled}
                  onChange={(e) => setCashbackEnabled(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-orange peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-orange/20"></div>
              </label>
            </div>
          </div>

          <div className={`mt-4 space-y-4 transition-opacity ${cashbackEnabled ? 'opacity-100' : 'opacity-50 grayscale'}`}>
            <div>
              <label className="text-xs font-semibold text-gray-700">Porcentaje de devolución (%)</label>
              <div className="relative mt-1">
                <input
                  value={cashbackPercent}
                  onChange={(e) => setCashbackPercent(e.target.value)}
                  disabled={!cashbackEnabled}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-brand-orange disabled:bg-gray-50"
                  inputMode="numeric"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-700">Fecha Inicio (Opcional)</label>
                <input
                  type="date"
                  value={cashbackStartDate}
                  onChange={(e) => setCashbackStartDate(e.target.value)}
                  disabled={!cashbackEnabled}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Fecha Fin (Opcional)</label>
                <input
                  type="date"
                  value={cashbackEndDate}
                  onChange={(e) => setCashbackEndDate(e.target.value)}
                  disabled={!cashbackEnabled}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange disabled:bg-gray-50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              * Si defines fechas, el cashback solo aplicará en ese rango. Si las dejas vacías, será permanente.
            </p>
          </div>
        </div>

        {/* Tax Withholding */}
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">🧾 Retenciones Fiscales (ISR / IVA)</div>
              <div className="mt-1 text-xs text-gray-600">Ley Plataformas Digitales 2020. Retención automática al vendedor.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${taxEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                {taxEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
              </span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={taxEnabled}
                  onChange={(e) => setTaxEnabled(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-green-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300/20"></div>
              </label>
            </div>
          </div>

          <div className={`mt-4 space-y-4 transition-opacity ${taxEnabled ? 'opacity-100' : 'opacity-50 grayscale'}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">ISR con RFC (%)</label>
                <div className="relative mt-1">
                  <input
                    value={taxIsrRate}
                    onChange={(e) => setTaxIsrRate(e.target.value)}
                    disabled={!taxEnabled}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50"
                    inputMode="decimal"
                    placeholder="1.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                </div>
                <p className="mt-1 text-[10px] text-gray-400">Enajenación de bienes (SAT)</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-red-700">ISR sin RFC (%)</label>
                <div className="relative mt-1">
                  <input
                    value={taxIsrNoRfcRate}
                    onChange={(e) => setTaxIsrNoRfcRate(e.target.value)}
                    disabled={!taxEnabled}
                    className="w-full rounded-xl border border-red-200 bg-red-50/30 px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-red-300 disabled:bg-gray-50"
                    inputMode="decimal"
                    placeholder="20.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-xs">%</span>
                </div>
                <p className="mt-1 text-[10px] text-red-400">Obligatorio por ley si no tiene RFC</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-blue-700">IVA retenido (%)</label>
                <div className="relative mt-1">
                  <input
                    value={taxIvaRate}
                    onChange={(e) => setTaxIvaRate(e.target.value)}
                    disabled={!taxEnabled}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50/30 px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                    inputMode="decimal"
                    placeholder="8.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">%</span>
                </div>
                <p className="mt-1 text-[10px] text-blue-400">50% del IVA (16%). Exento en usados.</p>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600 ring-1 ring-black/5">
              <strong>Nota:</strong> Artículos usados y casi nuevos están exentos de IVA (Art. 9 Frac IV LIVA). El ISR siempre aplica.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

