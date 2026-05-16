'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { normalizeMexicanCp } from '@/lib/utils/mexicanPostalCode';

type ProfileRow = {
  first_name: string;
  apellido_paterno: string;
  apellido_materno: string;
  nickname: string;
  rfc: string;
  curp: string;
  full_name: string;
  address_street: string;
  ext_number: string;
  int_number: string;
  neighborhood: string;
  zip_code: string;
  state: string;
  city: string;
  references: string;
  cross_streets: string;
  phone: string;
  ine_front_url: string;
  ine_back_url: string;
  selfie_ine_url: string;
  verification_status: 'none' | 'pending' | 'approved' | 'rejected';
  verification_rejection_reason: string;
};

type UploadResult = { url: string };

async function getAccessToken(): Promise<string> {
  const { data: sess, error } = await supabase.auth.getSession();
  if (error) throw error;
  let token = sess.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  const expiresAt = sess.session?.expires_at ? sess.session.expires_at * 1000 : 0;
  if (expiresAt && expiresAt < Date.now() + 60_000) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) throw refreshErr;
    token = refreshed.session?.access_token || token;
  }
  return token;
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', 'verification');
  const token = await getAccessToken();
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string };
  if (!res.ok) throw new Error(json?.error || 'No se pudo subir la imagen.');
  if (!json?.url) throw new Error('Respuesta inválida del servidor de upload.');
  return json.url;
}

function isFilled(value: string) {
  return value.trim().length > 0;
}

export default function VerificacionPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [ineFrontFile, setIneFrontFile] = useState<File | null>(null);
  const [ineBackFile, setIneBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [cpLoading, setCpLoading] = useState(false);
  const [coloniasOptions, setColoniasOptions] = useState<string[]>([]);
  const cpLookupGenRef = useRef(0);

  // Borra una foto de identidad del perfil
  const clearPhoto = async (field: 'ine_front_url' | 'ine_back_url' | 'selfie_ine_url') => {
    setForm((prev) => ({ ...prev, [field]: '' }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ [field]: '' }).eq('id', user.id);
  };

  const lookupPostalCode = async (cpRaw: string) => {
    const cp = normalizeMexicanCp(cpRaw);
    if (!cp) return;
    const gen = ++cpLookupGenRef.current;
    try {
      setCpLoading(true);
      const res = await fetch(`/api/cp?cp=${cp}`);
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (gen !== cpLookupGenRef.current) return;
      const estado = String(json.estado || json.state || '');
      const municipio = String(json.municipio || json.city || '');
      if (estado || municipio) {
        const colonias = (json.colonias as unknown[]) || [];
        const nombres: string[] = colonias
          .map((c: unknown) => String((c as { nombre?: string })?.nombre ?? c ?? '').trim())
          .filter(Boolean);
        setColoniasOptions(nombres);
        setForm((p) => {
          let neighborhood = p.neighborhood;
          if (nombres.length === 1) neighborhood = nombres[0];
          else if (nombres.length > 0 && !nombres.includes(p.neighborhood)) neighborhood = '';
          return {
            ...p,
            state: estado || p.state,
            city: municipio || p.city,
            neighborhood,
          };
        });
      }
    } catch {
      // noop
    } finally {
      if (gen === cpLookupGenRef.current) setCpLoading(false);
    }
  };

  const [form, setForm] = useState<ProfileRow>({
    first_name: '',
    apellido_paterno: '',
    apellido_materno: '',
    nickname: '',
    rfc: '',
    curp: '',
    full_name: '',
    address_street: '',
    ext_number: '',
    int_number: '',
    neighborhood: '',
    zip_code: '',
    state: '',
    city: '',
    references: '',
    cross_streets: '',
    phone: '',
    ine_front_url: '',
    ine_back_url: '',
    selfie_ine_url: '',
    verification_status: 'none',
    verification_rejection_reason: '',
  });


  const canSave = useMemo(() => {
    return (
      isFilled(email) &&
      isFilled(form.first_name) &&
      isFilled(form.apellido_paterno) &&
      isFilled(form.apellido_materno) &&
      isFilled(form.nickname) &&
      isFilled(form.rfc) &&
      isFilled(form.phone) &&
      isFilled(form.address_street) &&
      isFilled(form.ext_number) &&
      isFilled(form.neighborhood) &&
      isFilled(form.zip_code) &&
      isFilled(form.state) &&
      isFilled(form.city) &&
      (isFilled(form.ine_front_url) || Boolean(ineFrontFile)) &&
      (isFilled(form.ine_back_url) || Boolean(ineBackFile)) &&
      (isFilled(form.selfie_ine_url) || Boolean(selfieFile)) &&
      !isSaving
    );
  }, [email, form, ineFrontFile, ineBackFile, selfieFile, isSaving]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/';
          return;
        }
        if (!cancelled) setEmail(String(userData.user.email ?? '').trim());

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select(
            'first_name,apellido_paterno,apellido_materno,nickname,rfc,curp,full_name,address_street,ext_number,int_number,neighborhood,zip_code,state,city,references,cross_streets,phone,ine_front_url,ine_back_url,selfie_ine_url,is_verified,verification_status,verification_rejection_reason',
          )
          .eq('id', userData.user.id)
          .maybeSingle();

        // verification_status is handled in the form state below

        if (profileErr) {
          const anyErr = profileErr as any;
          const code = String(anyErr?.code || '');
          const msg = String(anyErr?.message || '');
          if (code === '42703' && msg.includes('ine_front_url')) {
            throw new Error(
              "Tu tabla `profiles` no tiene las columnas `ine_front_url` y `ine_back_url`. " +
              "Ejecuta el SQL `supabase_profiles_ine_migration.sql` en Supabase (SQL Editor) y vuelve a intentar.",
            );
          }
          if (code === '42703' && msg.includes('address_street')) {
            throw new Error(
              "Tu tabla `profiles` no tiene columnas de dirección (por ejemplo `address_street`). " +
              "Ejecuta el SQL `supabase_profiles_address_migration.sql` en Supabase (SQL Editor) y vuelve a intentar.",
            );
          }
          throw new Error(msg || 'Error al cargar tu perfil en la base de datos.');
        }
        if (!cancelled && profile) {
          setForm({
            first_name: (profile as any).first_name ?? '',
            apellido_paterno: (profile as any).apellido_paterno ?? '',
            apellido_materno: (profile as any).apellido_materno ?? '',
            nickname: (profile as any).nickname ?? '',
            rfc: (profile as any).rfc ?? '',
            curp: (profile as any).curp ?? '',
            full_name: (profile as any).full_name ?? '',
            address_street: (profile as any).address_street ?? '',
            ext_number: (profile as any).ext_number ?? '',
            int_number: (profile as any).int_number ?? '',
            neighborhood: (profile as any).neighborhood ?? '',
            zip_code: (profile as any).zip_code ?? '',
            state: (profile as any).state ?? '',
            city: (profile as any).city ?? '',
            references: (profile as any).references ?? '',
            cross_streets: (profile as any).cross_streets ?? '',
            phone: (profile as any).phone ?? '',
            ine_front_url: (profile as any).ine_front_url ?? '',
            ine_back_url: (profile as any).ine_back_url ?? '',
            selfie_ine_url: (profile as any).selfie_ine_url ?? '',
            verification_status: (profile as any).verification_status ?? 'none',
            verification_rejection_reason: (profile as any).verification_rejection_reason ?? '',
          });
          // Si ya tiene un CP guardado, buscar colonias automáticamente
          const savedZipNorm = normalizeMexicanCp(String((profile as any).zip_code ?? ''));
          if (savedZipNorm) {
            void lookupPostalCode(savedZipNorm);
          }
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar tu perfil.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setIsSaving(true);
      const token = await getAccessToken();

      let frontUrl = form.ine_front_url.trim();
      let backUrl = form.ine_back_url.trim();
      let selfieUrl = form.selfie_ine_url.trim();

      const uploadTasks: Array<Promise<void>> = [];
      if (ineFrontFile) {
        uploadTasks.push(
          (async () => {
            setSaveStep('Subiendo INE (frente)…');
            frontUrl = await uploadFile(ineFrontFile);
          })(),
        );
      }
      if (ineBackFile) {
        uploadTasks.push(
          (async () => {
            setSaveStep('Subiendo INE (reverso)…');
            backUrl = await uploadFile(ineBackFile);
          })(),
        );
      }
      if (selfieFile) {
        uploadTasks.push(
          (async () => {
            setSaveStep('Subiendo selfie con INE…');
            selfieUrl = await uploadFile(selfieFile);
          })(),
        );
      }
      if (uploadTasks.length > 0) {
        await Promise.all(uploadTasks);
      }

      if (!frontUrl || !backUrl || !selfieUrl) {
        throw new Error('Debes subir INE frente, reverso y selfie con INE.');
      }

      setSaveStep('Guardando datos en tu perfil…');

      const submitBody = {
        first_name: form.first_name,
        apellido_paterno: form.apellido_paterno,
        apellido_materno: form.apellido_materno,
        nickname: form.nickname,
        rfc: form.rfc,
        curp: form.curp,
        address_street: form.address_street,
        ext_number: form.ext_number,
        int_number: form.int_number,
        neighborhood: form.neighborhood,
        zip_code: form.zip_code,
        state: form.state,
        city: form.city,
        references: form.references,
        cross_streets: form.cross_streets,
        phone: form.phone,
        ine_front_url: frontUrl,
        ine_back_url: backUrl,
        selfie_ine_url: selfieUrl,
      };

      const res = await fetch('/api/verification/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitBody),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'No se pudo guardar tu verificación.');
      }

      const saved = json.profile as Record<string, unknown> | undefined;
      setForm((p) => ({
        ...p,
        first_name: String(saved?.first_name ?? p.first_name),
        apellido_paterno: String(saved?.apellido_paterno ?? p.apellido_paterno),
        apellido_materno: String(saved?.apellido_materno ?? p.apellido_materno),
        nickname: String(saved?.nickname ?? p.nickname),
        rfc: String(saved?.rfc ?? p.rfc),
        curp: String(saved?.curp ?? p.curp),
        full_name: String(saved?.full_name ?? p.full_name),
        address_street: String(saved?.address_street ?? p.address_street),
        ext_number: String(saved?.ext_number ?? p.ext_number),
        int_number: String(saved?.int_number ?? p.int_number),
        neighborhood: String(saved?.neighborhood ?? p.neighborhood),
        zip_code: String(saved?.zip_code ?? p.zip_code),
        state: String(saved?.state ?? p.state),
        city: String(saved?.city ?? p.city),
        references: String(saved?.references ?? p.references),
        cross_streets: String(saved?.cross_streets ?? p.cross_streets),
        phone: String(saved?.phone ?? p.phone),
        ine_front_url: String(saved?.ine_front_url ?? frontUrl),
        ine_back_url: String(saved?.ine_back_url ?? backUrl),
        selfie_ine_url: String(saved?.selfie_ine_url ?? selfieUrl),
        verification_status: (saved?.verification_status as ProfileRow['verification_status']) ?? 'pending',
        verification_rejection_reason: '',
      }));
      setIneFrontFile(null);
      setIneBackFile(null);
      setSelfieFile(null);
      setSuccess('Documentos enviados. Los mismos datos ya están en tu perfil; serán revisados por nuestro equipo.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu verificación.');
    } finally {
      setIsSaving(false);
      setSaveStep(null);
    }
  };


  if (isBooting) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-96 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Verificación</div>
              <div className="text-xs text-gray-500">Requerida para vender</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
          >
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
            Paso obligatorio
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Completa tu verificación</h1>
          <p className="mt-2 text-sm text-gray-600">
            Necesitamos tu dirección, tu INE (frente y reverso) y una selfie sosteniendo tu INE para habilitar ventas.
          </p>
        </div>

        {form.verification_status === 'approved' && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-white px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-800">✅ Identidad verificada</div>
            <p className="mt-1 text-sm text-green-700">Tu cuenta está verificada. Puedes vender productos en la plataforma.</p>
          </div>
        )}

        {form.verification_status === 'pending' && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">⏳ En revisión</div>
            <p className="mt-1 text-sm text-amber-700">Tus documentos fueron enviados y están siendo revisados por nuestro equipo. Te notificaremos cuando se aprueben.</p>
          </div>
        )}

        {form.verification_status === 'rejected' && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-800">❌ Verificación rechazada</div>
            {form.verification_rejection_reason && (
              <p className="mt-1 text-sm text-red-700"><strong>Motivo:</strong> {form.verification_rejection_reason}</p>
            )}
            <p className="mt-2 text-sm text-red-700">Por favor corrige los documentos y vuelve a enviarlos.</p>
          </div>
        )}


        {!isBooting && !email.trim() && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            El <span className="font-semibold">email</span> de tu cuenta es obligatorio para poder vender o publicar. Si no lo tienes configurado, actualízalo en <Link href="/dashboard/perfil" className="font-semibold text-brand-emerald underline">Mi perfil</Link> y vuelve aquí.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900">Datos de dirección</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-600">*</span></label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 outline-none"
                  placeholder="Correo de tu cuenta"
                />
                <div className="mt-1 text-xs text-gray-500">Obligatorio. Configúralo en Mi perfil si falta.</div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Nombre(s) <span className="text-red-600">*</span></label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellido Paterno <span className="text-red-600">*</span></label>
                <input
                  value={form.apellido_paterno}
                  onChange={(e) => setForm((p) => ({ ...p, apellido_paterno: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellido Materno <span className="text-red-600">*</span></label>
                <input
                  value={form.apellido_materno}
                  onChange={(e) => setForm((p) => ({ ...p, apellido_materno: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Seudónimo (Nombre de tienda) <span className="text-red-600">*</span></label>
                <input
                  value={form.nickname}
                  onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">RFC <span className="text-red-600">*</span></label>
                <input
                  value={form.rfc}
                  onChange={(e) => setForm((p) => ({ ...p, rfc: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">CURP (Opcional)</label>
                <input
                  value={form.curp}
                  onChange={(e) => setForm((p) => ({ ...p, curp: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Calle <span className="text-red-600">*</span></label>
                <input
                  value={form.address_street}
                  onChange={(e) => setForm((p) => ({ ...p, address_street: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Número exterior <span className="text-red-600">*</span></label>
                <input
                  value={form.ext_number}
                  onChange={(e) => setForm((p) => ({ ...p, ext_number: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Número interior</label>
                <input
                  value={form.int_number}
                  onChange={(e) => setForm((p) => ({ ...p, int_number: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Código postal <span className="text-red-600">*</span></label>
                <div className="relative">
                  <input
                    value={form.zip_code}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setForm((p) => ({ ...p, zip_code: v }));
                      if (v.length === 5) void lookupPostalCode(v);
                    }}
                    onBlur={(e) => {
                      const cp = normalizeMexicanCp(e.target.value);
                      if (cp) void lookupPostalCode(cp);
                    }}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="5 dígitos"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    required
                  />
                  {cpLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-emerald">Buscando...</div>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estado <span className="text-red-600">*</span></label>
                <input
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Municipio <span className="text-red-600">*</span></label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Colonia <span className="text-red-600">*</span></label>
                {coloniasOptions.length > 0 ? (
                  <select
                    value={form.neighborhood}
                    onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    required
                  >
                    <option value="">Selecciona tu colonia...</option>
                    {coloniasOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input
                    value={form.neighborhood}
                    onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    required
                  />
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Entre calles</label>
                <input
                  value={form.cross_streets}
                  onChange={(e) => setForm((p) => ({ ...p, cross_streets: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Referencias</label>
                <input
                  value={form.references}
                  onChange={(e) => setForm((p) => ({ ...p, references: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Teléfono <span className="text-red-600">*</span></label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900">Documentos de identidad</h2>
            <p className="mt-1 text-sm text-gray-600">Sube tu INE (frente y reverso) y una selfie sosteniendo tu INE. Puedes usar cámara en celular.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">INE Frente <span className="text-red-600">*</span></label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setIneFrontFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-brand-emerald file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
                />
                {isFilled(form.ine_front_url) && (
                  <div className="mt-2">
                    <img src={form.ine_front_url} alt="INE Frente" className="h-24 rounded-lg border border-gray-200 object-cover" />
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">INE frente guardado. Sube otro para reemplazar.</span>
                      <button type="button" onClick={() => clearPhoto('ine_front_url')} className="text-xs font-semibold text-red-500 hover:text-red-700">🗑 Borrar</button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">INE Reverso <span className="text-red-600">*</span></label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setIneBackFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-brand-emerald file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
                />
                {isFilled(form.ine_back_url) && (
                  <div className="mt-2">
                    <img src={form.ine_back_url} alt="INE Reverso" className="h-24 rounded-lg border border-gray-200 object-cover" />
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">INE reverso guardado. Sube otro para reemplazar.</span>
                      <button type="button" onClick={() => clearPhoto('ine_back_url')} className="text-xs font-semibold text-red-500 hover:text-red-700">🗑 Borrar</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Selfie sosteniendo tu INE <span className="text-red-600">*</span></label>
                <p className="mt-1 text-xs text-gray-500">Toma una foto de tu rostro sosteniendo tu INE junto a tu cara. Asegúrate de que ambas sean visibles y legibles.</p>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-brand-emerald file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
                />
                {isFilled(form.selfie_ine_url) && (
                  <div className="mt-2">
                    <img src={form.selfie_ine_url} alt="Selfie con INE" className="h-24 rounded-lg border border-gray-200 object-cover" />
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Selfie guardada. Sube otra para reemplazar.</span>
                      <button type="button" onClick={() => clearPhoto('selfie_ine_url')} className="text-xs font-semibold text-red-500 hover:text-red-700">🗑 Borrar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {(form.verification_status === 'none' || form.verification_status === 'rejected') && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canSave}
                className="rounded-xl bg-brand-emerald px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? saveStep || 'Enviando…' : form.verification_status === 'rejected' ? 'Reenviar documentos' : 'Enviar para revisión'}
              </button>
            </div>
          )}
          {isSaving && saveStep ? (
            <p className="mt-2 text-right text-xs text-gray-500">{saveStep}</p>
          ) : null}
        </form>
      </main>
    </div>
  );
}


