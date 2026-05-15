'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

import { checkLimit, PLAN_LIMITS, PlanType } from '@/lib/plans/limits';

type CouponRow = {
  id: string;
  seller_id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number | string;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  is_active: boolean;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string;
  status: string;
  images?: string[] | null;
  public_id?: string | null;
  sale_type?: 'direct' | 'auction' | null;
};

function toNumber(v: number | string | null | undefined) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDigits(raw: string) {
  const only = String(raw ?? '').replace(/[^\d]/g, '');
  // quitar ceros a la izquierda (evita "0200"), pero deja "0" si eso es lo único
  const trimmed = only.replace(/^0+(?=\d)/, '');
  return trimmed;
}

export default function CouponsPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [myListings, setMyListings] = useState<ListingRow[]>([]);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValueInput, setDiscountValueInput] = useState<string>('10');
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');
  // permitir vacío (para poder borrar el "0" visualmente)
  const [maxRedemptionsInput, setMaxRedemptionsInput] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [applyToAllListings, setApplyToAllListings] = useState(false);
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [couponListings, setCouponListings] = useState<Record<string, string[]>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [limitsUsage, setLimitsUsage] = useState<{ allowed: boolean; usage: number; limit: number; plan: PlanType } | null>(null);

  const effectiveSelectedIds = useMemo(
    () => (applyToAllListings ? myListings.map((l) => l.id) : selectedListingIds),
    [applyToAllListings, myListings, selectedListingIds],
  );

  const canSave = useMemo(() => {
    const discountValue = Number(discountValueInput || 0);
    if (!code.trim()) return false;
    if (discountValue <= 0) return false;
    if (discountType === 'percent' && discountValue > 100) return false;
    // Al editar, permitir guardar incluso si no hay listings seleccionados (para poder quitar todos)
    if (!editingCoupon && effectiveSelectedIds.length === 0) return false;
    return !isSaving;
  }, [code, discountValueInput, discountType, effectiveSelectedIds.length, isSaving, editingCoupon]);

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

        const [couponRes, listingRes, limitsRes] = await Promise.all([
          supabase
            .from('coupons')
            .select('id,seller_id,code,discount_type,discount_value,starts_at,ends_at,max_redemptions,is_active,created_at')
            .eq('seller_id', userData.user.id)
            .order('created_at', { ascending: false }),
          (async () => {
            // Intentar cargar con columnas modernas; fallback si no existen
            let res: any = await supabase
              .from('listings')
              .select('id,title,status,images,public_id,sale_type')
              .eq('seller_id', userData.user.id)
              .order('created_at', { ascending: false })
              .limit(200);
            if (res.error) {
              const code = String((res.error as any)?.code || '');
              const msg = String((res.error as any)?.message || '');
              if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
                res = await supabase
                  .from('listings')
                  .select('id,title,status,images,sale_type')
                  .eq('seller_id', userData.user.id)
                  .order('created_at', { ascending: false })
                  .limit(200);
              }
            }
            if (res.error) {
              const code = String((res.error as any)?.code || '');
              const msg = String((res.error as any)?.message || '');
              if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
                res = await supabase
                  .from('listings')
                  .select('id,title,status')
                  .eq('seller_id', userData.user.id)
                  .order('created_at', { ascending: false })
                  .limit(200);
              }
            }
            return res;
          })(),
          checkLimit(supabase, userData.user.id, 'coupons'),
        ]);

        if (couponRes.error) throw couponRes.error;
        if (listingRes.error) throw listingRes.error;
        if (!cancelled) {
          const couponsData = (couponRes.data as CouponRow[]) ?? [];
          setCoupons(couponsData);
          setMyListings((listingRes.data as ListingRow[]) ?? []);
          setLimitsUsage(limitsRes);
          
          // Cargar listings asociados a cada cupón
          const listingsMap: Record<string, string[]> = {};
          for (const coupon of couponsData) {
            const { data: links } = await supabase
              .from('coupon_listings')
              .select('listing_id')
              .eq('coupon_id', coupon.id);
            listingsMap[coupon.id] = (links ?? []).map((l: any) => l.listing_id);
          }
          setCouponListings(listingsMap);
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar cupones.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleListing = (id: string) => {
    if (applyToAllListings) return;
    setSelectedListingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleApplyToAllChange = (checked: boolean) => {
    setApplyToAllListings(checked);
    if (checked) setSelectedListingIds([]);
  };

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setIsSaving(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/';
        return;
      }

      const codeNorm = code.trim().toUpperCase();
      const discountValue = Number(discountValueInput || 0);
      const maxRedemptions = Number(maxRedemptionsInput || 0);
      const payload = {
        seller_id: user.id,
        code: codeNorm,
        discount_type: discountType,
        discount_value: discountValue,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        max_redemptions: maxRedemptions > 0 ? maxRedemptions : null,
        is_active: Boolean(isActive),
      };

      const { data: c, error: cErr } = await supabase.from('coupons').insert([payload]).select('*').single();
      if (cErr) throw cErr;

      const couponId = (c as any).id as string;
      const idsToLink = applyToAllListings ? myListings.map((l) => l.id) : selectedListingIds;
      const links = idsToLink.map((listing_id) => ({ coupon_id: couponId, listing_id }));
      const { error: linkErr } = await supabase.from('coupon_listings').insert(links);
      if (linkErr) throw linkErr;

      setCoupons((prev) => [(c as CouponRow), ...prev]);
      setSuccess('Cupón creado.');
      setCode('');
      setDiscountValueInput(discountType === 'percent' ? '10' : '25');
      setStartsAt('');
      setEndsAt('');
      setMaxRedemptionsInput('');
      setApplyToAllListings(false);
      setSelectedListingIds([]);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo crear el cupón.');
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (coupon: CouponRow) => {
    console.log('[COUPONS] Abriendo edición de cupón:', { couponId: coupon.id, code: coupon.code });
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDiscountType(coupon.discount_type);
    setDiscountValueInput(String(coupon.discount_value));
    setStartsAt(coupon.starts_at ? new Date(coupon.starts_at).toISOString().slice(0, 16) : '');
    setEndsAt(coupon.ends_at ? new Date(coupon.ends_at).toISOString().slice(0, 16) : '');
    setMaxRedemptionsInput(coupon.max_redemptions ? String(coupon.max_redemptions) : '');
    setIsActive(coupon.is_active);
    const linkedListings = couponListings[coupon.id] || [];
    if (linkedListings.length === myListings.length && myListings.length > 0) {
      setApplyToAllListings(true);
      setSelectedListingIds([]);
    } else {
      setApplyToAllListings(false);
      setSelectedListingIds(linkedListings);
    }
    setError(null);
    setSuccess(null);
    
    // Desplazar hacia el formulario después de un pequeño delay para que se actualice el DOM
    setTimeout(() => {
      const formElement = document.getElementById('coupon-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const cancelEdit = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountValueInput(discountType === 'percent' ? '10' : '25');
    setStartsAt('');
    setEndsAt('');
    setMaxRedemptionsInput('');
    setApplyToAllListings(false);
    setSelectedListingIds([]);
    setIsActive(true);
    setError(null);
    setSuccess(null);
  };

  const updateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[COUPONS] updateCoupon llamado', { 
      editingCoupon: editingCoupon?.id, 
      code, 
      discountType, 
      discountValueInput,
      isSaving,
      canSave 
    });
    
    if (!editingCoupon) {
      console.error('[COUPONS] No hay cupón en edición');
      setError('No hay cupón seleccionado para editar.');
      return;
    }
    
    if (isSaving) {
      console.warn('[COUPONS] Ya se está guardando, ignorando...');
      return;
    }
    
    setError(null);
    setSuccess(null);

    try {
      setIsSaving(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/';
        return;
      }

      const codeNorm = code.trim().toUpperCase();
      const discountValue = Number(discountValueInput || 0);
      const maxRedemptions = Number(maxRedemptionsInput || 0);
      const payload = {
        code: codeNorm,
        discount_type: discountType,
        discount_value: discountValue,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        max_redemptions: maxRedemptions > 0 ? maxRedemptions : null,
        is_active: Boolean(isActive),
      };

      console.log('[COUPONS] Actualizando cupón:', {
        couponId: editingCoupon.id,
        payload,
        sellerId: user.id,
      });

      const { data: updateData, error: updateErr } = await supabase
        .from('coupons')
        .update(payload)
        .eq('id', editingCoupon.id)
        .eq('seller_id', user.id)
        .select('id,code,discount_type,discount_value,starts_at,ends_at,max_redemptions,is_active');
      
      console.log('[COUPONS] Resultado de update:', { updateData, updateErr });
      
      if (updateErr) {
        console.error('[COUPONS] Error actualizando cupón:', updateErr);
        throw updateErr;
      }
      
      // Verificar que realmente se actualizó
      if (!updateData || updateData.length === 0) {
        console.warn('[COUPONS] No se actualizó ningún cupón. Verificando permisos...');
        // Verificar que el cupón existe y pertenece al usuario
        const { data: checkCoupon } = await supabase
          .from('coupons')
          .select('id,seller_id')
          .eq('id', editingCoupon.id)
          .single();
        
        if (!checkCoupon) {
          throw new Error('El cupón no existe.');
        }
        if (checkCoupon.seller_id !== user.id) {
          throw new Error('No tienes permisos para editar este cupón.');
        }
        throw new Error('No se pudo actualizar el cupón. Verifica los datos.');
      }

      // Actualizar listings asociados
      console.log('[COUPONS] Eliminando listings antiguos...');
      const { error: deleteLinksErr } = await supabase
        .from('coupon_listings')
        .delete()
        .eq('coupon_id', editingCoupon.id);
      if (deleteLinksErr) {
        console.error('[COUPONS] Error eliminando listings:', deleteLinksErr);
        throw deleteLinksErr;
      }

      const idsToLink = applyToAllListings ? myListings.map((l) => l.id) : selectedListingIds;
      console.log('[COUPONS] Listings a vincular:', { idsToLink, applyToAllListings, selectedListingIds });
      
      if (idsToLink.length > 0) {
        const links = idsToLink.map((listing_id) => ({ coupon_id: editingCoupon.id, listing_id }));
        const { error: linkErr } = await supabase.from('coupon_listings').insert(links);
        if (linkErr) {
          console.error('[COUPONS] Error insertando listings:', linkErr);
          throw linkErr;
        }
        console.log('[COUPONS] Listings vinculados exitosamente');
      } else {
        console.warn('[COUPONS] No hay listings para vincular');
      }

      // Recargar cupones desde la BD para verificar
      console.log('[COUPONS] Recargando cupón desde BD...');
      const { data: updatedCoupon, error: reloadErr } = await supabase
        .from('coupons')
        .select('id,seller_id,code,discount_type,discount_value,starts_at,ends_at,max_redemptions,is_active,created_at')
        .eq('id', editingCoupon.id)
        .single();
      
      if (reloadErr) {
        console.error('[COUPONS] Error recargando cupón:', reloadErr);
        throw new Error(`No se pudo verificar la actualización: ${reloadErr.message}`);
      }
      
      if (!updatedCoupon) {
        throw new Error('El cupón no se encontró después de actualizar.');
      }
      
      console.log('[COUPONS] Cupón recargado:', updatedCoupon);
      
      // Actualizar estado local
      setCoupons((prev) => prev.map((c) => (c.id === editingCoupon.id ? (updatedCoupon as CouponRow) : c)));
      
      // Actualizar listings del cupón
      const { data: links, error: linksErr } = await supabase
        .from('coupon_listings')
        .select('listing_id')
        .eq('coupon_id', editingCoupon.id);
      
      if (linksErr) {
        console.warn('[COUPONS] Error cargando listings:', linksErr);
      } else {
        setCouponListings((prev) => ({
          ...prev,
          [editingCoupon.id]: (links ?? []).map((l: any) => l.listing_id),
        }));
        console.log('[COUPONS] Listings actualizados:', links);
      }

      setSuccess('Cupón actualizado correctamente.');
      console.log('[COUPONS] ✅ Cupón actualizado exitosamente');
      
      // Recargar cupones para asegurar que se muestren los datos actualizados
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: refreshedCoupons } = await supabase
            .from('coupons')
            .select('id,seller_id,code,discount_type,discount_value,starts_at,ends_at,max_redemptions,is_active,created_at')
            .eq('seller_id', userData.user.id)
            .order('created_at', { ascending: false });
          
          if (refreshedCoupons) {
            setCoupons(refreshedCoupons as CouponRow[]);
            
            // Recargar listings asociados
            const listingsMap: Record<string, string[]> = {};
            for (const coupon of refreshedCoupons) {
              const { data: links } = await supabase
                .from('coupon_listings')
                .select('listing_id')
                .eq('coupon_id', coupon.id);
              listingsMap[coupon.id] = (links ?? []).map((l: any) => l.listing_id);
            }
            setCouponListings(listingsMap);
          }
        }
      } catch (reloadErr) {
        console.warn('[COUPONS] Error recargando cupones después de actualizar:', reloadErr);
      }
      
      cancelEdit();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el cupón.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCoupon = async (couponId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este cupón? Esta acción no se puede deshacer.')) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsDeleting(couponId);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/';
        return;
      }

      // Eliminar cupón (los links se eliminan automáticamente por CASCADE)
      const { error: deleteErr } = await supabase
        .from('coupons')
        .delete()
        .eq('id', couponId)
        .eq('seller_id', user.id);
      if (deleteErr) throw deleteErr;

      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      setCouponListings((prev) => {
        const next = { ...prev };
        delete next[couponId];
        return next;
      });
      setSuccess('Cupón eliminado.');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el cupón.');
    } finally {
      setIsDeleting(null);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="h-12 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Cupones</div>
              <div className="text-xs text-gray-500">Solo para tus publicaciones</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {limitsUsage && limitsUsage.plan === 'basic' && (
          <div className="mb-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100">
            <div className="flex items-center gap-2 font-semibold">
              <span>Plan Básico:</span>
              <span className={limitsUsage.allowed ? 'text-green-600' : 'text-red-600'}>
                {limitsUsage.limit - limitsUsage.usage} cupones restantes
              </span>
              <span className="text-gray-500 font-normal">(Límite: {limitsUsage.limit}/mes)</span>
            </div>
            <p className="mt-1 text-xs text-blue-700">
              Los usuarios PRO tienen cupones ilimitados.{' '}
              <Link href="/dashboard/pro" className="underline font-bold hover:text-blue-900">
                Mejorar plan
              </Link>
            </p>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              {editingCoupon ? 'Editar cupón' : 'Crear cupón'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {editingCoupon ? 'Modifica los datos del cupón.' : 'Se aplicará solo a las publicaciones que selecciones.'}
            </p>

            {editingCoupon && (
              <div className="mt-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
                Editando: <span className="font-semibold">{editingCoupon.code}</span>
              </div>
            )}

            {limitsUsage && !limitsUsage.allowed && !editingCoupon && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Has alcanzado el límite de {limitsUsage.limit} cupones mensuales.
                {limitsUsage.plan !== 'pro' && (
                  <Link href="/dashboard/pro" className="ml-1 font-bold underline">
                    Actualiza a PRO para cupones ilimitados.
                  </Link>
                )}
              </div>
            )}
            
            {limitsUsage && limitsUsage.allowed && !editingCoupon && limitsUsage.plan !== 'pro' && (
               <div className="mt-2 text-xs font-bold text-gray-500">
                 Cupones restantes este mes: {limitsUsage.limit - limitsUsage.usage}
               </div>
            )}

            <form id="coupon-form" onSubmit={editingCoupon ? updateCoupon : createCoupon} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Código</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    placeholder="EJ: GOPOCKET10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  >
                    <option value="percent">% descuento</option>
                    <option value="fixed">$ fijo</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Valor {discountType === 'percent' ? '(1–100)' : '(MXN)'}
                  </label>
                  <input
                    value={discountValueInput}
                    onChange={(e) => setDiscountValueInput(normalizeDigits(e.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    placeholder={discountType === 'percent' ? '10' : '25'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Máx. redenciones (0 = sin límite)</label>
                  <input
                    value={maxRedemptionsInput}
                    onChange={(e) => setMaxRedemptionsInput(normalizeDigits(e.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Inicio (opcional)</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fin (opcional)</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Activo</div>
                  <div className="mt-1 text-xs text-gray-600">Puedes pausarlo cuando quieras.</div>
                </div>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              </label>

              <div>
                <div className="text-sm font-semibold text-gray-900">Aplicar a publicaciones</div>
                {myListings.length > 0 ? (
                  <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-brand-emerald/30 bg-pink-50/50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={applyToAllListings}
                      onChange={(e) => handleApplyToAllChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Aplicar a todas mis publicaciones</div>
                      <div className="mt-0.5 text-xs text-gray-600">Marca esto para que el cupón aplique a todas sin elegir una por una.</div>
                    </div>
                  </label>
                ) : null}
                <div className="mt-2 max-h-56 overflow-auto rounded-2xl border border-black/5">
                  {myListings.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">Aún no tienes publicaciones.</div>
                  ) : applyToAllListings ? (
                    <div className="flex items-center gap-3 p-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        ✓ Todas seleccionadas
                      </span>
                      <span className="text-sm text-gray-600">
                        {myListings.length} {myListings.length === 1 ? 'publicación' : 'publicaciones'}
                      </span>
                    </div>
                  ) : (
                    <div className="divide-y divide-black/5">
                      {myListings.map((l) => (
                        <label key={l.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-gray-50/50">
                          <input
                            type="checkbox"
                            checked={selectedListingIds.includes(l.id)}
                            onChange={() => toggleListing(l.id)}
                          />
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                              {Array.isArray((l as any).images) && (l as any).images.length > 0 ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={String((l as any).images[0] || '')} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold text-gray-900 line-clamp-1">{l.title}</div>
                                {(l as any).public_id ? (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                    ID: {String((l as any).public_id)}
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                  {(l as any).sale_type === 'auction' ? 'Subasta' : 'Venta directa'}
                                </span>
                              </div>
                              <div className="mt-0.5 text-xs text-gray-500">{l.status}</div>
                            </div>
                            <Link
                              href={`/listings/${l.id}`}
                              className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver
                            </Link>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                {editingCoupon && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!canSave}
                  className={`${editingCoupon ? 'flex-1' : 'w-full'} rounded-xl bg-brand-emerald px-4 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isSaving ? (editingCoupon ? 'Actualizando…' : 'Creando…') : (editingCoupon ? 'Actualizar cupón' : 'Crear cupón')}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900">Mis cupones</h2>
            <p className="mt-1 text-sm text-gray-600">Estos cupones solo aplican a tus publicaciones.</p>

            <div className="mt-5 space-y-3">
              {coupons.length === 0 ? (
                <div className="text-sm text-gray-600">Aún no tienes cupones.</div>
              ) : (
                coupons.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-black/5 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-extrabold text-gray-900">{c.code}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          {c.discount_type === 'percent'
                            ? `${toNumber(c.discount_value)}%`
                            : `$${toNumber(c.discount_value)} MXN`}{' '}
                          · {c.is_active ? 'Activo' : 'Pausado'}
                        </div>
                        {couponListings[c.id] && couponListings[c.id].length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Aplica a {couponListings[c.id].length} {couponListings[c.id].length === 1 ? 'publicación' : 'publicaciones'}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs font-semibold text-gray-500">
                          {new Date(c.created_at).toLocaleDateString('es-MX')}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('[COUPONS] Botón Editar clickeado para cupón:', c.id);
                              openEdit(c);
                            }}
                            disabled={isDeleting === c.id || (!!editingCoupon && editingCoupon.id !== c.id)}
                            className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCoupon(c.id)}
                            disabled={isDeleting === c.id || !!editingCoupon}
                            className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDeleting === c.id ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

