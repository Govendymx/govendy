'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageTour } from '@/components/PageTour';
import { pageTours } from '@/lib/tours/config';

type ProfileRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address_street?: string | null;
  ext_number?: string | null;
  int_number?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  state?: string | null;
  city?: string | null;
  references?: string | null;
  cross_streets?: string | null;
  ine_front_url?: string | null;
  ine_back_url?: string | null;
  payout_bank_name?: string | null;
  payout_account_holder?: string | null;
  payout_clabe?: string | null;
  payout_account_number?: string | null;
  payout_notes?: string | null;
  mercadopago_account?: string | null;
  plan_type?: string | null;
  store_logo_url?: string | null;
  official_store_slogan?: string | null;
  nickname?: string | null;
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'No se pudo subir la imagen.');
  return json.url;
}

export default function DashboardPerfilPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(true);
  const [isResettingTour, setIsResettingTour] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpColonias, setCpColonias] = useState<string[]>([]);
  const [cpAutoFilled, setCpAutoFilled] = useState(false);
  const [cpError, setCpError] = useState('');

  const lookupPostalCode = async (cp: string) => {
    if (!/^\d{5}$/.test(cp)) return;
    try {
      setCpLoading(true);
      setCpAutoFilled(false);
      setCpError('');
      const res = await fetch(`/api/postal-code/lookup?cp=${cp}`);
      const json = await res.json();
      console.log('[CP LOOKUP] Response:', json);

      // Check for estado/municipio - works with or without ok flag
      const estado = json.estado || json.state || '';
      const municipio = json.municipio || json.city || '';

      if (estado || municipio) {
        setForm((p) => ({
          ...p,
          state: estado || p.state,
          city: municipio || p.city,
        }));
        const colonias = json.colonias || [];
        const nombres = colonias.map((c: any) => String(c.nombre || c || '').trim()).filter(Boolean);
        setCpColonias(nombres);
        if (nombres.length === 1) {
          setForm((p) => ({ ...p, neighborhood: nombres[0] }));
        }
        setCpAutoFilled(true);
      } else {
        console.warn('[CP LOOKUP] No estado/municipio found in response:', json);
        setCpError('No se encontró información para este CP');
      }
    } catch (err) {
      console.error('[CP LOOKUP] Error:', err);
      setCpError('Error al buscar el código postal');
    } finally {
      setCpLoading(false);
    }
  };

  const [form, setForm] = useState({
    full_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    rfc: '',
    address_street: '',
    ext_number: '',
    int_number: '',
    neighborhood: '',
    zip_code: '',
    state: '',
    city: '',
    references: '',
    cross_streets: '',
    payout_bank_name: '',
    payout_account_holder: '',
    payout_clabe: '',
    payout_account_number: '',
    payout_notes: '',
    mercadopago_account: '',
    store_logo_url: '',
    is_official_store: false,
    official_store_name: '',
    official_store_banner_url: '',
    official_store_brand_color: '#000000',
    official_store_slogan: '',
    nickname: '',
  });

  const [returnTo, setReturnTo] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const docsCount = useMemo(() => {
    const front = String(profile?.ine_front_url || '').trim();
    const back = String(profile?.ine_back_url || '').trim();
    return [front, back].filter(Boolean).length;
  }, [profile]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setReturnTo(String(sp.get('returnTo') || '').trim());
      setReason(String(sp.get('reason') || '').trim());
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        setSuccess(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          window.location.href = '/login';
          return;
        }

        if (!cancelled) {
          setEmail(user.email || '');
          setCreatedAt(String((user as any).created_at || ''));
        }

        const { data, error: pErr } = await supabase
          .from('profiles')
          .select(
            'id,full_name,first_name,last_name,phone,rfc,address_street,ext_number,int_number,neighborhood,zip_code,state,city,references,cross_streets,ine_front_url,ine_back_url,payout_bank_name,payout_account_holder,payout_clabe,payout_account_number,payout_notes,mercadopago_account,has_seen_onboarding_tour,plan_type,store_logo_url,is_official_store,official_store_name,official_store_banner_url,official_store_brand_color,official_store_slogan,nickname',
          )
          .eq('id', user.id)
          .maybeSingle();

        if (pErr) {
          const anyErr = pErr as any;
          const code = String(anyErr?.code || '');
          const msg = String(anyErr?.message || '');
          if (code === '42703') {
            setError(
              'Tu tabla `profiles` no tiene todas las columnas de perfil/dirección. Ejecuta los SQL de migración (address + INE) y recarga.',
            );
            return;
          }
          throw pErr;
        }

        const row = (data as any) as ProfileRow | null;
        if (!cancelled) {
          setProfile(row);
          setHasSeenTour(Boolean((row as any)?.has_seen_onboarding_tour ?? true));

          let fn = String(row?.first_name || '').trim();
          let ln = String(row?.last_name || '').trim();
          const fullName = String(row?.full_name || '').trim();

          // Fallback: si no hay first_name/last_name pero sí full_name, intentar separar
          if (!fn && !ln && fullName) {
            const parts = fullName.split(' ');
            if (parts.length === 1) {
              fn = parts[0];
            } else if (parts.length >= 2) {
              fn = parts[0];
              ln = parts.slice(1).join(' ');
            }
          }

          setForm({
            full_name: fullName,
            first_name: fn,
            last_name: ln,
            phone: String(row?.phone || ''),
            rfc: String((row as any)?.rfc || ''),
            address_street: String(row?.address_street || ''),
            ext_number: String(row?.ext_number || ''),
            int_number: String(row?.int_number || ''),
            neighborhood: String(row?.neighborhood || ''),
            zip_code: String(row?.zip_code || ''),
            state: String(row?.state || ''),
            city: String(row?.city || ''),
            references: String(row?.references || ''),
            cross_streets: String(row?.cross_streets || ''),
            payout_bank_name: String((row as any)?.payout_bank_name || ''),
            payout_account_holder: String((row as any)?.payout_account_holder || ''),
            payout_clabe: String((row as any)?.payout_clabe || ''),
            payout_account_number: String((row as any)?.payout_account_number || ''),
            payout_notes: String((row as any)?.payout_notes || ''),
            mercadopago_account: String((row as any)?.mercadopago_account || ''),
            store_logo_url: String((row as any)?.store_logo_url || ''),
            is_official_store: Boolean((row as any)?.is_official_store || false),
            official_store_name: String((row as any)?.official_store_name || ''),
            official_store_banner_url: String((row as any)?.official_store_banner_url || ''),
            official_store_brand_color: String((row as any)?.official_store_brand_color || '#000000'),
            official_store_slogan: String((row as any)?.official_store_slogan || ''),
            nickname: String((row as any)?.nickname || ''),
          });
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar tu perfil.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const requiredAddressFields = [
    { key: 'first_name' as const, label: 'Nombre(s)' },
    { key: 'last_name' as const, label: 'Apellidos' },
    { key: 'phone' as const, label: 'Teléfono' },
    { key: 'address_street' as const, label: 'Calle' },
    { key: 'ext_number' as const, label: 'No. exterior' },
    { key: 'int_number' as const, label: 'No. interior' },
    { key: 'neighborhood' as const, label: 'Colonia' },
    { key: 'zip_code' as const, label: 'CP' },
    { key: 'state' as const, label: 'Estado' },
    { key: 'city' as const, label: 'Ciudad' },
    { key: 'references' as const, label: 'Referencias' },
    { key: 'cross_streets' as const, label: 'Entre calles' },
  ];

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const missingLabels = requiredAddressFields.filter((f) => !String(form[f.key] ?? '').trim()).map((f) => f.label);
      if (!String(email ?? '').trim()) missingLabels.push('Email');
      if (missingLabels.length > 0) {
        setError(
          `Para poder vender o publicar, todos los datos de contacto, dirección y email son obligatorios. Faltan: ${missingLabels.join(', ')}.`,
        );
        return;
      }

      setIsSaving(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const payload: any = {
        id: user.id,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim() || null,
        phone: form.phone.trim() || null,
        rfc: form.rfc.trim().toUpperCase() || null,
        address_street: form.address_street.trim() || null,
        ext_number: form.ext_number.trim() || null,
        int_number: form.int_number.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        zip_code: form.zip_code.trim() || null,
        state: form.state.trim() || null,
        city: form.city.trim() || null,
        references: form.references.trim() || null,
        cross_streets: form.cross_streets.trim() || null,
        payout_bank_name: form.payout_bank_name.trim() || null,
        payout_account_holder: form.payout_account_holder.trim() || null,
        payout_clabe: form.payout_clabe.trim() || null,
        payout_account_number: form.payout_account_number.trim() || null,
        payout_notes: form.payout_notes.trim() || null,
        mercadopago_account: form.mercadopago_account.trim() || null,
        store_logo_url: form.store_logo_url.trim() || null,
        // is_official_store is managed by admin only
        official_store_name: form.official_store_name.trim() || null,
        official_store_banner_url: form.official_store_banner_url.trim() || null,
        official_store_brand_color: form.official_store_brand_color.trim() || null,
        official_store_slogan: form.official_store_slogan.trim() || null,
        nickname: (['pro', 'platinum'].includes(String(profile?.plan_type || '')))
          ? (form.nickname.trim().slice(0, 10) || null)
          : null,
      };

      const { data: saved, error: upErr } = await supabase.from('profiles').upsert([payload]).select('*').single();
      if (upErr) throw upErr;
      setProfile(saved as any);
      setSuccess('Perfil actualizado.');

      if (returnTo) {
        setTimeout(() => {
          window.location.href = returnTo;
        }, 700);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo guardar tu perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTour = async () => {
    try {
      setIsResettingTour(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/login';
        return;
      }

      // Resetear en la base de datos
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ has_seen_onboarding_tour: false })
        .eq('id', user.id);

      if (upErr) throw upErr;

      // Resetear en localStorage - limpiar todos los tours de todas las páginas
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(`pocket_tour_`) && key.endsWith(`_${user.id}`)) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem(`pocket_tour_seen_${user.id}`);

      setHasSeenTour(false);
      setSuccess('Tours reactivados. Se mostrarán la próxima vez que visites cada página.');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo reactivar el tour.');
    } finally {
      setIsResettingTour(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  const healthy = docsCount >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Mi perfil</div>
              <div className="text-xs text-gray-500">Información de tu cuenta</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageTour steps={pageTours.perfil || []} pageId="perfil" />
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}
        {reason === 'address_required' ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Para vender o publicar, todos los <span className="font-semibold">datos de contacto, dirección y email</span> son obligatorios. Complétalos más abajo y guarda.
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8" data-tour="documents">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Estado de cuenta</div>
              <div className="mt-1 text-sm text-gray-600">
                {healthy ? (
                  <span className="font-semibold text-green-700">Saludable</span>
                ) : (
                  <span className="font-semibold text-amber-700">Pendiente de verificación</span>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Email: <span className="font-semibold text-gray-700">{email || '—'}</span> · Ingreso: <span className="font-semibold text-gray-700">{createdAt ? new Date(createdAt).toLocaleDateString('es-MX') : '—'}</span>
              </div>
            </div>
            <Link href="/verificacion" className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Verificación
            </Link>
          </div>
        </section>

        {/* Tienda Oficial */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-gray-900">Tienda Oficial</div>
                {form.is_official_store && (
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    Verificada
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {form.is_official_store
                  ? 'Tu perfil está verificado como Tienda Oficial. Puedes personalizar tu marca abajo.'
                  : 'Convierte tu perfil en una Tienda Oficial (Solo por Invitacion). Requiere verificación del administrador.'}
              </div>
            </div>

            {!form.is_official_store && (
              <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                Solo Administradores
              </div>
            )}
          </div>

          {form.is_official_store && (
            <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Nombre Oficial de la Tienda</label>
                  <input
                    type="text"
                    value={form.official_store_name}
                    onChange={(e) => setForm({ ...form, official_store_name: e.target.value })}
                    className="mt-1 block w-full rounded-xl border-gray-200 bg-gray-50 text-sm focus:border-brand-orange focus:ring-brand-orange"
                    placeholder="Ej. Samsung Oficial"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Frase / Eslogan</label>
                  <input
                    type="text"
                    value={form.official_store_slogan}
                    onChange={(e) => setForm({ ...form, official_store_slogan: e.target.value })}
                    className="mt-1 block w-full rounded-xl border-gray-200 bg-gray-50 text-sm focus:border-brand-orange focus:ring-brand-orange"
                    placeholder="Ej. La mejor tecnología en tu bolsillo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Color de Marca (Hex)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={form.official_store_brand_color}
                      onChange={(e) => setForm({ ...form, official_store_brand_color: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                    />
                    <input
                      type="text"
                      value={form.official_store_brand_color}
                      onChange={(e) => setForm({ ...form, official_store_brand_color: e.target.value })}
                      className="block w-full rounded-xl border-gray-200 bg-gray-50 text-sm focus:border-brand-orange focus:ring-brand-orange"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Banner de Tienda Oficial</label>
                <div className="mt-2">
                  {form.official_store_banner_url ? (
                    <div className="relative h-32 w-full overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                      <img
                        src={form.official_store_banner_url}
                        alt="Banner"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, official_store_banner_url: '' })}
                        className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pb-6 pt-5">
                        <svg className="mb-3 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click para subir banner</span></p>
                        <p className="text-xs text-gray-500">Recomendado: 1200x300 px</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        disabled={isUploadingBanner}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setIsUploadingBanner(true);
                            setError(null);
                            const url = await uploadFile(file);
                            setForm((p) => ({ ...p, official_store_banner_url: url }));
                          } catch (err: any) {
                            setError(err.message || 'Error al subir banner');
                          } finally {
                            setIsUploadingBanner(false);
                          }
                        }}
                      />
                    </label>
                  )}
                  {isUploadingBanner && <div className="mt-1 text-xs text-brand-orange">Subiendo...</div>}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Preferencias */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="text-sm font-bold text-gray-900">Preferencias</div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Tours guiados</div>
                <div className="mt-1 text-xs text-gray-600">
                  {hasSeenTour
                    ? 'Los tours están desactivados. Puedes reactivarlos para verlos en todas las páginas.'
                    : 'Los tours están activados. Se mostrarán en cada página hasta que los desactives.'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { data: userData } = await supabase.auth.getUser();
                      if (!userData.user) return;
                      await supabase
                        .from('profiles')
                        .update({ has_seen_onboarding_tour: !hasSeenTour })
                        .eq('id', userData.user.id);
                      setHasSeenTour(!hasSeenTour);
                      setSuccess(!hasSeenTour ? 'Tours desactivados.' : 'Tours activados.');
                    } catch (e) {
                      setError('No se pudo actualizar.');
                    }
                  }}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200"
                >
                  {hasSeenTour ? 'Activar' : 'Desactivar'}
                </button>
                <button
                  type="button"
                  onClick={handleResetTour}
                  disabled={isResettingTour}
                  className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isResettingTour ? 'Reactivando…' : 'Reactivar todos'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={onSave} className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8 space-y-4" data-tour="personal-info">
          <div className="text-lg font-bold text-gray-900">Editar perfil</div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 ring-1 ring-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900">Logo de tu tienda</div>
                <div className="mt-1 text-xs text-gray-600">
                  Aparecerá en tus publicaciones y perfil público.
                </div>
              </div>
              {profile?.plan_type === 'pro' ? (
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand-orange ring-1 ring-pink-100">
                  PRO
                </div>
              ) : (
                <Link
                  href="/dashboard/pro"
                  className="rounded-full bg-gray-200 px-3 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-300"
                >
                  Solo PRO (Mejorar)
                </Link>
              )}
            </div>

            <div className="mt-4 flex items-center gap-6">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                {form.store_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.store_logo_url} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                    Sin logo
                  </div>
                )}
              </div>

              <div>
                {profile?.plan_type === 'pro' ? (
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
                      {isUploadingLogo ? 'Subiendo...' : 'Subir imagen'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        disabled={isUploadingLogo}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setIsUploadingLogo(true);
                            setError(null);
                            const url = await uploadFile(file);
                            setForm((p) => ({ ...p, store_logo_url: url }));
                          } catch (err: any) {
                            setError(err.message || 'Error al subir logo');
                          } finally {
                            setIsUploadingLogo(false);
                          }
                        }}
                      />
                    </label>
                    <div className="text-xs text-gray-500">JPG, PNG. Max 5MB.</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Esta función es exclusiva para usuarios <span className="font-bold text-brand-orange">PRO</span>.
                  </div>
                )}
              </div>
            </div>

            {form.is_official_store && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="block text-xs font-semibold text-gray-700">Frase de tu tienda oficial</label>
                <input
                  type="text"
                  value={form.official_store_slogan}
                  onChange={(e) => setForm({ ...form, official_store_slogan: e.target.value })}
                  className="mt-1 block w-full rounded-xl border-gray-200 bg-white text-sm focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="Escribe tu eslogan aquí..."
                />
                <p className="mt-1 text-[10px] text-gray-500">Esta frase aparecerá debajo de tu logo en el carrusel de la página de inicio.</p>
              </div>
            )}
          </div>

          {/* ── Seudónimo PRO / Platinum ── */}
          <div className="rounded-2xl border border-pink-100 bg-pink-50/30 p-5 ring-1 ring-pink-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-gray-900">Seudónimo</div>
                  <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#c0005a] to-[#e3127d] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    PRO / Platinum
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Aparece en tu tienda, publicaciones y perfil — en lugar de tu nombre real. Máximo 10 caracteres.
                </div>
              </div>
            </div>

            <div className="mt-4">
              {['pro', 'platinum'].includes(String(profile?.plan_type || '')) ? (
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.nickname}
                      maxLength={10}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 10);
                        setForm((p) => ({ ...p, nickname: val }));
                      }}
                      className="block w-full rounded-xl border border-gray-300 px-4 py-3 pr-16 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                      placeholder="Ej: FashionMx"
                    />
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${form.nickname.length >= 10 ? 'text-red-500' : 'text-gray-400'}`}>
                      {form.nickname.length}/10
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Si lo dejas vacío, se mostrará tu nombre real.
                  </p>
                  {form.nickname && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                      <span>Vista previa:</span>
                      <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 font-semibold text-brand-orange">
                        {form.nickname}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <div className="text-sm text-gray-500">
                    Exclusivo para <Link href="/dashboard/pro" className="font-bold text-brand-orange hover:underline">PRO o Platinum</Link>.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 ring-1 ring-amber-100">
            <div className="text-sm font-bold text-gray-900">Datos de contacto <span className="text-amber-700">*</span></div>
            <div className="mt-1 text-xs text-gray-600">Obligatorios para poder vender o publicar.</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre(s) <span className="text-red-600">*</span></label>
                  <input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellidos <span className="text-red-600">*</span></label>
                  <input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Tus apellidos" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono <span className="text-red-600">*</span></label>
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="10 dígitos" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-600">*</span></label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 outline-none"
                  placeholder="Correo de tu cuenta"
                />
                <div className="mt-1 text-xs text-gray-500">Email de tu cuenta (obligatorio). Si no lo tienes, actualízalo en la configuración de tu cuenta o con soporte.</div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">RFC <span className="text-xs font-normal text-gray-400">(opcional)</span></label>
                <input
                  value={form.rfc}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, 13);
                    setForm((p) => ({ ...p, rfc: val }));
                  }}
                  maxLength={13}
                  className={`mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange ${form.rfc && (form.rfc.length === 12 || form.rfc.length === 13)
                      ? 'border-green-400 bg-green-50/50'
                      : form.rfc && form.rfc.length > 0
                        ? 'border-amber-300'
                        : 'border-gray-300'
                    }`}
                  placeholder="Ej. XAXX010101000"
                />
                <div className="mt-1 text-[11px] text-gray-500">
                  {!form.rfc ? (
                    <span className="text-amber-600">⚠️ Sin RFC se aplica retención máxima de ISR (20%). Agrégalo para reducirla a 1%.</span>
                  ) : form.rfc.length === 13 ? (
                    <span className="text-green-600">✓ RFC de persona física (13 caracteres)</span>
                  ) : form.rfc.length === 12 ? (
                    <span className="text-green-600">✓ RFC de persona moral (12 caracteres)</span>
                  ) : (
                    <span className="text-amber-600">RFC debe tener 12 (moral) o 13 (física) caracteres</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div id="datos-cobro" className="mt-4 rounded-3xl border border-pink-100 bg-pink-50/40 p-5 ring-1 ring-pink-100" data-tour="payout-info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-gray-900">Datos de cobro (para liberación de dinero)</div>
                <div className="mt-1 text-xs text-gray-600">
                  Estos datos se usan para que soporte/admin pueda pagarte cuando se liberen tus ventas. (Ejemplo México: CLABE)
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand-orange ring-1 ring-pink-100">PRO</div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Banco</label>
                <input
                  value={form.payout_bank_name}
                  onChange={(e) => setForm((p) => ({ ...p, payout_bank_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="Ej: BBVA, Banamex, Santander…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Titular</label>
                <input
                  value={form.payout_account_holder}
                  onChange={(e) => setForm((p) => ({ ...p, payout_account_holder: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="Nombre del titular de la cuenta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">CLABE (18 dígitos)</label>
                <input
                  value={form.payout_clabe}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\s+/g, '');
                    setForm((p) => ({ ...p, payout_clabe: next }));
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  inputMode="numeric"
                  placeholder="000000000000000000"
                />
                <div className="mt-1 text-[11px] text-gray-600">Tip: sin espacios. Si no aplica en tu país, déjalo en blanco.</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Número de cuenta (opcional)</label>
                <input
                  value={form.payout_account_number}
                  onChange={(e) => setForm((p) => ({ ...p, payout_account_number: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="Opcional"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Cuenta de MercadoPago</label>
                <input
                  type="email"
                  value={form.mercadopago_account}
                  onChange={(e) => setForm((p) => ({ ...p, mercadopago_account: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="tu-email@mercadopago.com o ID de cuenta"
                />
                <div className="mt-1 text-[11px] text-gray-600">
                  Ingresa el email asociado a tu cuenta de MercadoPago o el ID de cuenta para recibir pagos directamente.
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Notas (opcional)</label>
                <textarea
                  value={form.payout_notes}
                  onChange={(e) => setForm((p) => ({ ...p, payout_notes: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="Ej: horario de transferencias, referencia, etc."
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 ring-1 ring-amber-100">
            <div className="text-sm font-bold text-gray-900">Dirección <span className="text-amber-700">*</span></div>
            <div className="mt-1 text-xs text-gray-600">Todos los campos son obligatorios para vender o publicar.</div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Calle <span className="text-red-600">*</span></label>
                <input value={form.address_street} onChange={(e) => setForm((p) => ({ ...p, address_street: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Calle y número" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">No. ext <span className="text-red-600">*</span></label>
                  <input value={form.ext_number} onChange={(e) => setForm((p) => ({ ...p, ext_number: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">No. int <span className="text-red-600">*</span></label>
                  <input value={form.int_number} onChange={(e) => setForm((p) => ({ ...p, int_number: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="O S/N si no aplica" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">CP <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <input
                      value={form.zip_code}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                        setForm((p) => ({ ...p, zip_code: v }));
                        if (v.length === 5) lookupPostalCode(v);
                        if (v.length < 5) { setCpAutoFilled(false); setCpColonias([]); }
                      }}
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="Ej. 76729"
                      className={`mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange ${cpAutoFilled ? 'border-green-400 bg-green-50/50' : 'border-gray-300'}`}
                    />
                    {cpLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin h-4 w-4 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      </div>
                    )}
                    {cpAutoFilled && !cpLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                  {cpAutoFilled && <div className="mt-1 text-[10px] text-green-600 font-medium">✓ Estado y ciudad autocompletados</div>}
                  {cpError && !cpLoading && <div className="mt-1 text-[10px] text-red-500 font-medium">{cpError}</div>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Colonia <span className="text-red-600">*</span></label>
                  {cpColonias.length > 1 ? (
                    <>
                      <select
                        value={form.neighborhood}
                        onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange bg-white"
                      >
                        <option value="">Selecciona tu colonia</option>
                        {cpColonias.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="mt-1 text-[10px] text-gray-500">{cpColonias.length} colonias encontradas</div>
                    </>
                  ) : (
                    <input value={form.neighborhood} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ciudad <span className="text-red-600">*</span></label>
                  <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className={`mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange ${cpAutoFilled ? 'border-green-400 bg-green-50/50' : 'border-gray-300'}`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado <span className="text-red-600">*</span></label>
                <input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} className={`mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange ${cpAutoFilled ? 'border-green-400 bg-green-50/50' : 'border-gray-300'}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Entre calles <span className="text-red-600">*</span></label>
                <input value={form.cross_streets} onChange={(e) => setForm((p) => ({ ...p, cross_streets: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Ej. entre Juárez y Hidalgo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Referencias <span className="text-red-600">*</span></label>
                <textarea value={form.references} onChange={(e) => setForm((p) => ({ ...p, references: e.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange" placeholder="Ej. edificio color blanco, portón negro" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isSaving} className="rounded-xl bg-brand-orange px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:opacity-60">
              {isSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

