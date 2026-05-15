'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

function getFriendlyErrorMessage(err: unknown) {
  if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.';
  }
  return err instanceof Error ? err.message : 'Error de conexión. Por favor, intenta de nuevo.';
}

const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
  'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
  'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz',
  'Yucatán','Zacatecas',
];

type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);

  const [form, setForm] = useState({
    // Paso 1: Cuenta
    email: '',
    password: '',
    confirmPassword: '',
    // Paso 2: Datos personales
    first_name: '',
    apellido_paterno: '',
    apellido_materno: '',
    last_name: '', // computed from apellido_paterno + apellido_materno
    nickname: '',
    phone: '',
    rfc: '',
    // Paso 3: Dirección
    address_street: '',
    ext_number: '',
    int_number: '',
    neighborhood: '',
    zip_code: '',
    state: '',
    city: '',
    references: '',
    cross_streets: '',
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (error) setError(null);
  };

  const lookupPostalCode = async (cp: string) => {
    if (!/^\d{5}$/.test(cp)) return;
    try {
      setCpLoading(true);
      const res = await fetch(`/api/postal-code/lookup?cp=${cp}`);
      const json = await res.json();
      const estado = json.estado || json.state || '';
      const municipio = json.municipio || json.city || '';
      if (estado || municipio) {
        setForm(p => ({ ...p, state: estado || p.state, city: municipio || p.city }));
        const colonias = json.colonias || [];
        const nombres: string[] = colonias.map((c: any) => String(c.nombre || c || '').trim()).filter(Boolean);
        if (nombres.length === 1) setForm(p => ({ ...p, neighborhood: nombres[0] }));
      }
    } catch {
      // noop
    } finally {
      setCpLoading(false);
    }
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!form.email || !form.password || !form.confirmPassword) {
        setError('Por favor, completa todos los campos.'); return false;
      }
      if (form.password !== form.confirmPassword) {
        setError('Las contraseñas no coinciden.'); return false;
      }
      if (form.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.'); return false;
      }
    }
    if (step === 2) {
      if (!form.first_name || !form.apellido_paterno || !form.phone) {
        setError('Nombre(s), apellido paterno y teléfono son obligatorios.'); return false;
      }
    }
    if (step === 3) {
      if (!form.address_street || !form.ext_number || !form.zip_code || !form.state || !form.city) {
        setError('Calle, número exterior, CP, estado y ciudad son obligatorios.'); return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (!validateStep()) return;
    setStep(prev => (prev < 3 ? (prev + 1) as Step : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep()) return;
    setIsLoading(true);

    try {
      const last_name = `${form.apellido_paterno.trim()} ${form.apellido_materno.trim()}`.trim();
      const full_name = `${form.first_name.trim()} ${last_name}`.trim();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            username: form.nickname || form.first_name,
            full_name,
            phone: form.phone,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Error al crear la cuenta.');
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError('No se pudo crear el usuario. Intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      // Guardar perfil completo en la tabla profiles
      const last_name_final = `${form.apellido_paterno.trim()} ${form.apellido_materno.trim()}`.trim();
      await supabase.from('profiles').upsert([{
        id: data.user.id,
        full_name,
        first_name: form.first_name.trim() || null,
        last_name: last_name_final || null,
        phone: form.phone.trim() || null,
        rfc: form.rfc.trim().toUpperCase() || null,
        nickname: form.nickname.trim() || null,
        address_street: form.address_street.trim() || null,
        ext_number: form.ext_number.trim() || null,
        int_number: form.int_number.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        zip_code: form.zip_code.trim() || null,
        state: form.state.trim() || null,
        city: form.city.trim() || null,
        references: form.references.trim() || null,
        cross_streets: form.cross_streets.trim() || null,
      }]);

      // Email de bienvenida
      try {
        await fetch('/api/auth/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id }),
        });
      } catch {
        // No bloquear el flujo
      }

      setSuccess(true);
      window.location.href = '/subir-ine';
    } catch (err: unknown) {
      setError(getFriendlyErrorMessage(err));
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-brand-emerald';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

  const steps = [
    { num: 1, label: 'Tu cuenta' },
    { num: 2, label: 'Datos personales' },
    { num: 3, label: 'Dirección' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fdfa] via-white to-[#f0fdf4]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full items-stretch gap-8 lg:grid-cols-2">

          {/* Panel Izquierdo — Marca & Beneficios */}
          <section className="hidden lg:flex">
            <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-brand-emerald via-[#0f9b85] to-[#0d7a6a] p-10 text-white shadow-2xl">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-volt blur-3xl" />
                <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-white/30 blur-3xl" />
              </div>

              <div className="relative">
                <img src="/logo.png" alt="GoVendy" className="h-10 w-auto object-contain brightness-0 invert" />
                <h2 className="mt-6 text-3xl font-extrabold tracking-tight leading-snug">
                  El marketplace que{' '}
                  <span className="text-brand-volt">te impulsa</span>{' '}
                  a vender más
                </h2>
                <p className="mt-3 text-sm text-white/80 leading-relaxed">
                  Crea tu cuenta en minutos, sube tus productos y empieza a recibir pedidos desde cualquier parte de México.
                </p>

                <div className="mt-10 space-y-4">
                  {[
                    { icon: '🚀', title: 'Publica en segundos', desc: 'Sube fotos, precio y tu producto estará en vivo al instante.' },
                    { icon: '🔒', title: 'Compra 100% protegida', desc: 'Sistema escrow que protege tanto compradores como vendedores.' },
                    { icon: '📦', title: 'Envíos GoVendy con Estafeta', desc: 'Cotización automática y guías en un clic.' },
                    { icon: '💰', title: 'Recibe tus pagos rápido', desc: 'Retiros directos a tu cuenta bancaria o CLABE.' },
                  ].map(b => (
                    <div key={b.title} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/20">
                      <span className="text-2xl">{b.icon}</span>
                      <div>
                        <div className="text-sm font-bold">{b.title}</div>
                        <div className="mt-0.5 text-xs text-white/70">{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex items-center gap-2 text-xs text-white/60">
                  <span className="h-px flex-1 bg-white/20" />
                  <span>¿Ya tienes cuenta?</span>
                  <Link href="/login" className="font-bold text-brand-volt hover:underline">Inicia sesión</Link>
                  <span className="h-px flex-1 bg-white/20" />
                </div>
              </div>
            </div>
          </section>

          {/* Panel Derecho — Formulario */}
          <section className="flex items-center">
            <div className="w-full">
              {/* Header móvil del logo */}
              <div className="mb-6 flex items-center justify-between lg:hidden">
                <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
                <Link href="/login" className="text-sm font-semibold text-brand-emerald hover:underline">
                  ¿Ya tienes cuenta?
                </Link>
              </div>

              <div className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-black/5 sm:p-8 backdrop-blur">
                {/* Título */}
                <div className="space-y-1">
                  <h1 className="text-2xl font-extrabold text-brand-onyx sm:text-3xl">Crear cuenta</h1>
                  <p className="text-sm text-gray-500">Completa los pasos para registrarte y empezar a vender.</p>
                </div>

                {/* Stepper */}
                <div className="mt-6 flex items-center gap-2">
                  {steps.map((s, i) => (
                    <div key={s.num} className="flex flex-1 items-center gap-1">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-all ${
                        step > s.num ? 'bg-brand-emerald text-white' :
                        step === s.num ? 'bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {step > s.num ? '✓' : s.num}
                      </div>
                      <span className={`hidden text-xs font-semibold sm:block ${step === s.num ? 'text-brand-emerald' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                      {i < steps.length - 1 && (
                        <div className={`ml-1 h-0.5 flex-1 rounded-full transition-all ${step > s.num ? 'bg-brand-emerald' : 'bg-gray-100'}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Alertas */}
                <div className="mt-5 space-y-3">
                  {success && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                      ✅ ¡Registro exitoso! Redirigiendo...
                    </div>
                  )}
                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">

                  {/* ── PASO 1: Cuenta ── */}
                  {step === 1 && (
                    <>
                      <div>
                        <label htmlFor="email" className={labelClass}>Correo electrónico</label>
                        <input id="email" name="email" type="email" value={form.email} onChange={set('email')}
                          placeholder="tu@email.com" required autoComplete="email" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="password" className={labelClass}>Contraseña</label>
                        <div className="relative">
                          <input id="password" name="password" type={showPassword ? 'text' : 'password'}
                            value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres"
                            required minLength={6} className={inputClass + ' pr-11'} />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="confirmPassword" className={labelClass}>Confirmar contraseña</label>
                        <div className="relative">
                          <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                            value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repite tu contraseña"
                            required minLength={6} className={inputClass + ' pr-11'} />
                          <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── PASO 2: Datos personales ── */}
                  {step === 2 && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="first_name" className={labelClass}>Nombre(s) <span className="text-red-500">*</span></label>
                          <input id="first_name" type="text" value={form.first_name} onChange={set('first_name')}
                            placeholder="Tu(s) nombre(s)" className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="apellido_paterno" className={labelClass}>Apellido Paterno <span className="text-red-500">*</span></label>
                          <input id="apellido_paterno" type="text" value={form.apellido_paterno} onChange={set('apellido_paterno')}
                            placeholder="Apellido paterno" className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="apellido_materno" className={labelClass}>Apellido Materno <span className="text-red-500">*</span></label>
                          <input id="apellido_materno" type="text" value={form.apellido_materno} onChange={set('apellido_materno')}
                            placeholder="Apellido materno" className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="nickname" className={labelClass}>
                          Nombre de usuario / Apodo
                          <span className="ml-1 text-xs font-normal text-gray-400">(aparece en tu tienda)</span>
                        </label>
                        <input id="nickname" type="text" value={form.nickname} onChange={set('nickname')}
                          placeholder="Ej. MiTiendaMx" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="phone" className={labelClass}>Teléfono <span className="text-red-500">*</span></label>
                        <input id="phone" type="tel" value={form.phone} onChange={set('phone')}
                          placeholder="10 dígitos" maxLength={10} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="rfc" className={labelClass}>
                          RFC
                          <span className="ml-1 text-xs font-normal text-gray-400">(opcional, para facturación)</span>
                        </label>
                        <input id="rfc" type="text" value={form.rfc} onChange={set('rfc')}
                          placeholder="XAXX010101000" maxLength={13} className={inputClass} />
                      </div>
                    </>
                  )}

                  {/* ── PASO 3: Dirección ── */}
                  {step === 3 && (
                    <>
                      <div className="rounded-xl bg-brand-emerald/5 px-4 py-3 text-xs text-brand-emerald font-medium ring-1 ring-brand-emerald/20">
                        📦 Tu dirección se usará como dirección de origen para envíos con Estafeta. Asegúrate de que sea correcta.
                      </div>

                      <div>
                        <label htmlFor="zip_code" className={labelClass}>Código Postal <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-2">
                          <input id="zip_code" type="text" value={form.zip_code}
                            onChange={e => { set('zip_code')(e); if (e.target.value.length === 5) lookupPostalCode(e.target.value); }}
                            placeholder="5 dígitos" maxLength={5} className={inputClass} />
                          {cpLoading && <div className="text-xs text-brand-emerald font-semibold whitespace-nowrap">Buscando...</div>}
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="state" className={labelClass}>Estado <span className="text-red-500">*</span></label>
                          <select id="state" value={form.state} onChange={set('state')}
                            className={inputClass}>
                            <option value="">Selecciona...</option>
                            {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="city" className={labelClass}>Ciudad / Municipio <span className="text-red-500">*</span></label>
                          <input id="city" type="text" value={form.city} onChange={set('city')}
                            placeholder="Tu ciudad" className={inputClass} />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="address_street" className={labelClass}>Calle <span className="text-red-500">*</span></label>
                        <input id="address_street" type="text" value={form.address_street} onChange={set('address_street')}
                          placeholder="Nombre de la calle" className={inputClass} />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label htmlFor="ext_number" className={labelClass}>No. Exterior <span className="text-red-500">*</span></label>
                          <input id="ext_number" type="text" value={form.ext_number} onChange={set('ext_number')}
                            placeholder="123" className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="int_number" className={labelClass}>No. Interior</label>
                          <input id="int_number" type="text" value={form.int_number} onChange={set('int_number')}
                            placeholder="Depto A" className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="neighborhood" className={labelClass}>Colonia</label>
                          <input id="neighborhood" type="text" value={form.neighborhood} onChange={set('neighborhood')}
                            placeholder="Tu colonia" className={inputClass} />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="cross_streets" className={labelClass}>Entre calles</label>
                        <input id="cross_streets" type="text" value={form.cross_streets} onChange={set('cross_streets')}
                          placeholder="Ej. Entre Av. Juárez y Morelos" className={inputClass} />
                      </div>

                      <div>
                        <label htmlFor="references" className={labelClass}>Referencias del domicilio</label>
                        <textarea id="references" value={form.references} onChange={set('references')}
                          placeholder="Ej. Casa azul, frente al parque..."
                          rows={2}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-brand-emerald resize-none" />
                      </div>
                    </>
                  )}

                  {/* Botones de navegación */}
                  <div className="flex items-center gap-3 pt-2">
                    {step > 1 && (
                      <button type="button" onClick={() => setStep(s => (s - 1) as Step)}
                        className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                        ← Atrás
                      </button>
                    )}

                    {step < 3 ? (
                      <button type="button" onClick={handleNext}
                        className="flex-1 rounded-xl bg-brand-emerald py-3 text-sm font-extrabold text-white shadow-lg shadow-brand-emerald/25 hover:opacity-90 transition-opacity">
                        Continuar →
                      </button>
                    ) : (
                      <button type="submit" disabled={isLoading || success}
                        className="flex-1 rounded-xl bg-brand-emerald py-3 text-sm font-extrabold text-white shadow-lg shadow-brand-emerald/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 transition-opacity">
                        {isLoading ? 'Creando tu cuenta...' : success ? '¡Registro exitoso! ✓' : '🚀 Crear cuenta'}
                      </button>
                    )}
                  </div>

                  {step === 1 && (
                    <p className="text-center text-xs text-gray-400">
                      Al registrarte aceptas nuestros{' '}
                      <Link href="/terminos-y-condiciones" className="underline hover:text-gray-600">términos y condiciones</Link>.
                    </p>
                  )}
                </form>
              </div>

              {/* Link login desktop */}
              <p className="mt-4 hidden text-center text-sm text-gray-500 lg:block">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="font-bold text-brand-emerald hover:underline">Inicia sesión</Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}