'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CopyButton } from '@/components/ui/CopyButton';

function formatMoney(v: number) {
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function fmtDate(input?: string | null) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

type UserRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  username?: string | null;
  phone?: string | null;
  ine_front_url?: string | null;
  ine_back_url?: string | null;
  selfie_ine_url?: string | null;
  verification_status?: string | null;
  verification_rejection_reason?: string | null;
  address?: any;
  created_at?: string | null;
  auth_created_at?: string | null;
  last_sign_in_at?: string | null;
  encrypted_password?: string | null;
  admin_state?: any;
  is_verified?: boolean | null;
  stats?: {
    ventas_count: number;
    ventas_total: number;
    compras_count: number;
    compras_total: number;
    comision_total: number;
    envios_total: number;
    ventas_total_count?: number;
    compras_total_count?: number;
    ventas_cancelled_count?: number;
    compras_cancelled_count?: number;
    operations_count?: number;
    disputes_buyer?: number;
    disputes_seller?: number;
    disputes_open?: number;
    disputes_total?: number;
    withdrawn_total?: number;
  } | null;
  wallet_balance?: number;
};

type RatingRow = { id: string; order_id: string; rater_id: string; rater_name?: string; direction: string; stars: number; comment: string; created_at?: string };
type UserDetail = {
  user: {
    id: string;
    email?: string | null;
    auth_created_at?: string | null;
    last_sign_in_at?: string | null;
    profile: any;
    admin_state: any;
    is_verified: boolean;
    wallet_balance?: number;
    stats: {
      ventas_count: number;
      ventas_total: number;
      ventas_total_count: number;
      ventas_cancelled_count: number;
      compras_count: number;
      compras_total: number;
      compras_total_count: number;
      compras_cancelled_count: number;
      operations_count: number;
      disputes_buyer: number;
      disputes_seller: number;
      disputes_open: number;
      disputes_total: number;
      withdrawn_total: number;
    };
    ratings: RatingRow[];
    recent_orders: any[];
    disputes_as_buyer: any[];
    disputes_as_seller: any[];
  };
};

export default function AdminUsuariosPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'suspended'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [impersonationPassword, setImpersonationPassword] = useState('');
  const [isImpersonatingRequest, setIsImpersonatingRequest] = useState(false);

  const [suspendDays, setSuspendDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingRating, setEditingRating] = useState<RatingRow | null>(null);
  const [editStars, setEditStars] = useState('5');
  const [editComment, setEditComment] = useState('');
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);

  // Verification review state
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [verificationImageModal, setVerificationImageModal] = useState<string | null>(null);

  // Audit & Official Store State
  const [auditManualReputation, setAuditManualReputation] = useState('');
  const [auditManualSales, setAuditManualSales] = useState('');
  const [auditAdminNotes, setAuditAdminNotes] = useState('');
  const [auditIsOfficial, setAuditIsOfficial] = useState(false);
  const [auditOfficialName, setAuditOfficialName] = useState('');
  const [auditOfficialBanner, setAuditOfficialBanner] = useState('');
  const [auditOfficialColor, setAuditOfficialColor] = useState('');
  const [auditIsWholesaler, setAuditIsWholesaler] = useState(false);
  const [auditIsManufacturer, setAuditIsManufacturer] = useState(false);

  const saveAudit = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/users/update-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selected.id,
          manual_reputation_score: auditManualReputation,
          manual_sales_count: auditManualSales,
          admin_notes: auditAdminNotes,
          is_official_store: auditIsOfficial,
          official_store_name: auditOfficialName,
          official_store_banner_url: auditOfficialBanner,
          official_store_brand_color: auditOfficialColor,
          is_wholesaler: auditIsWholesaler,
          is_manufacturer: auditIsManufacturer,
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Error actualizando auditoría');

      setSuccess('Datos de auditoría actualizados.');
      void loadDetail(selected.id);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error al guardar auditoría');
    } finally {
      setIsSaving(false);
    }
  };

  // Location Editing State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locZip, setLocZip] = useState('');
  const [locState, setLocState] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locColony, setLocColony] = useState('');
  const [locStreet, setLocStreet] = useState('');
  const [locExt, setLocExt] = useState('');
  const [locInt, setLocInt] = useState('');
  const [locRefs, setLocRefs] = useState('');
  const [locCross, setLocCross] = useState('');
  const [locColonies, setLocColonies] = useState<any[]>([]);

  // Plan Dates Editing
  const [showPlanDatesModal, setShowPlanDatesModal] = useState(false);
  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');

  const openPlanDatesModal = () => {
    if (!detail?.user?.profile) return;
    const p = detail.user.profile;
    const toInput = (iso?: string) => {
      if (!iso) return '';
      try {
        return new Date(iso).toISOString().slice(0, 16);
      } catch { return ''; }
    };
    setPlanStart(toInput(p.pro_subscription_start));
    setPlanEnd(toInput(p.pro_subscription_end));
    setShowPlanDatesModal(true);
  };

  const savePlanDates = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/users/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: selected.id,
          plan: 'pro',
          pro_subscription_start: planStart ? new Date(planStart).toISOString() : null,
          pro_subscription_end: planEnd ? new Date(planEnd).toISOString() : null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error actualizando fechas');
      setSuccess('Vigencia actualizada.');
      setShowPlanDatesModal(false);
      void loadDetail(selected.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openLocationModal = () => {
    if (!detail?.user?.profile && !selected) return;
    // Prefer detail profile, fallback to selected (though selected has limited fields usually)
    // Actually selected.address might be there
    const p = detail?.user?.profile || selected?.address || {};
    setLocZip(p.zip_code || '');
    setLocState(p.state || '');
    setLocCity(p.city || '');
    setLocColony(p.neighborhood || '');
    setLocStreet(p.address_street || '');
    setLocExt(p.ext_number || '');
    setLocInt(p.int_number || '');
    setLocRefs(p.references || '');
    setLocCross(p.cross_streets || '');
    setLocColonies([]); // Reset colonies on open, or maybe fetch?
    setShowLocationModal(true);
  };

  const handleZipLookup = async () => {
    if (!locZip || locZip.length < 5) {
      alert('Ingresa un código postal válido (5 dígitos)');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/postal-code/lookup?cp=${locZip}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setLocState(data.estado);
        setLocCity(data.municipio);
        setLocColonies(data.colonias || []);
        if (data.colonias?.length > 0) {
          setLocColony(data.colonias[0].nombre);
        }
      } else {
        alert(data.error || 'No se encontró información para este CP.');
      }
    } catch (e) {
      console.error(e);
      alert('Error al consultar CP.');
    }
  };

  const saveLocation = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/users/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selected.id,
          zip_code: locZip,
          state: locState,
          city: locCity,
          neighborhood: locColony,
          address_street: locStreet,
          ext_number: locExt,
          int_number: locInt,
          references: locRefs,
          cross_streets: locCross
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Error actualizando ubicación');

      setSuccess('Ubicación actualizada correctamente.');
      setShowLocationModal(false);
      void loadDetail(selected.id);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error al guardar ubicación');
    } finally {
      setIsSaving(false);
    }
  };

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState<'credit' | 'debit'>('credit');
  const [walletConcept, setWalletConcept] = useState('');

  const handleWalletAdjust = async () => {
    if (!selected) return;
    const amt = Number(walletAmount);
    if (!walletAmount || isNaN(amt) || amt <= 0) {
      alert('Monto inválido. Debe ser mayor a 0.');
      return;
    }
    if (!walletConcept.trim()) {
      alert('El concepto es obligatorio para auditoría.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }

      const res = await fetch('/api/admin/wallet/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selected.id,
          amount: amt,
          type: walletType,
          concept: walletConcept
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Error ajustando saldo');

      setSuccess('Saldo ajustado correctamente.');
      setShowWalletModal(false);
      setWalletAmount('');
      setWalletConcept('');

      // Reload detail to get fresh balance
      void loadDetail(selected.id);

      // Update row locally to reflect change immediately in list
      setRows(prev => prev.map(r => {
        if (r.id === selected.id) {
          const current = r.wallet_balance || 0;
          const change = amt;
          const newBal = walletType === 'credit' ? current + change : current - change; // allow negative temporarily in UI even if DB constraints it
          return {
            ...r,
            wallet_balance: newBal
          };
        }
        return r;
      }));

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error al ajustar saldo.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelRate = (cancelled: number, total: number) => {
    const t = Number(total || 0) || 0;
    const c = Number(cancelled || 0) || 0;
    if (t <= 0) return 0;
    return Math.round((c / t) * 100);
  };

  const displayName = (u: UserRow) => {
    const parts = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    if (parts) return parts;
    return String(u.full_name || '').trim() ||
      String(u.nickname || '').trim() ||
      String(u.username || '').trim() ||
      `${u.id.slice(0, 6)}…`;
  };

  const currentStateLabel = useMemo(() => {
    if (!selected) return '—';
    const st = String(selected?.admin_state?.status || 'active');
    if (st === 'deleted') return 'Eliminada';
    if (st === 'banned') return 'Bloqueada';
    if (st === 'suspended') return `Suspendida (hasta ${String(selected?.admin_state?.suspended_until || '—')})`;
    return 'Activa';
  }, [selected]);

  const loadDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/admin/users/${userId}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as any)?.ok) {
        const d = json as UserDetail;
        setDetail(d);
        // Load audit fields
        const p = d.user.profile || {};
        setAuditManualReputation(p.manual_reputation_score?.toString() || '');
        setAuditManualSales(p.manual_sales_count?.toString() || '');
        setAuditAdminNotes(p.admin_notes || '');
        setAuditIsOfficial(!!p.is_official_store);
        setAuditOfficialName(p.official_store_name || '');
        setAuditOfficialBanner(p.official_store_banner_url || '');
        setAuditOfficialColor(p.official_store_brand_color || '');
        setAuditIsWholesaler(!!p.is_wholesaler);
        setAuditIsManufacturer(!!p.is_manufacturer);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStartImpersonation = async () => {
    if (!selected) return;
    if (!impersonationPassword.trim()) {
      alert('Ingresa tu contraseña de administrador.');
      return;
    }
    setIsImpersonatingRequest(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }
      const res = await fetch('/api/admin/impersonation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: selected.id,
          adminPassword: impersonationPassword,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo iniciar impersonation');
      }
      setShowImpersonateModal(false);
      setImpersonationPassword('');
      window.open(`/dashboard?impersonating=${encodeURIComponent(selected.id)}`, '_blank');
    } catch (e: any) {
      setError(e.message || 'Error iniciando impersonation');
    } finally {
      setIsImpersonatingRequest(false);
    }
  };

  const search = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setSelected(null);
    setDetail(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }
      const filterParam = userFilter !== 'all' ? `&filter=${userFilter}` : '';
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q.trim())}&limit=40${filterParam}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar usuarios.');
      setRows((json?.users ?? []) as UserRow[]);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar todos al entrar (sin necesidad de buscar)
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) {
          window.location.href = '/login?returnTo=/admin/usuarios';
          return;
        }
        const filterParam = userFilter !== 'all' ? `&filter=${userFilter}` : '';
        const res = await fetch(`/api/admin/users/search?limit=100${filterParam}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar usuarios.');
        if (!cancelled) setRows((json?.users ?? []) as UserRow[]);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar usuarios.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [userFilter]);

  const updatePlan = async (newPlan: 'basic' | 'pro' | 'platinum') => {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }
      const res = await fetch('/api/admin/users/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: selected.id, plan: newPlan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar el plan.');

      setSuccess(`Plan actualizado a ${newPlan.toUpperCase()}.`);
      // Recargar detalle para ver cambios
      void loadDetail(selected.id);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const applyState = async (action: 'activate' | 'suspend' | 'ban' | 'delete') => {
    if (!selected) return;

    // Confirmación para eliminar
    if (action === 'delete') {
      if (!confirm('⚠️ ¿Estás SEGURO de que quieres ELIMINAR este usuario?\n\nEsta acción:\n- Marcará al usuario como eliminado\n- Bloqueará su acceso permanentemente\n- Ocultará sus listados\n\nNo se recomienda si el usuario tiene transacciones activas.')) {
        return;
      }
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }
      const days = action === 'suspend' ? Math.max(1, Number(suspendDays || 7)) : 0;
      const res = await fetch('/api/admin/users/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: selected.id, action, days, notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar el estado.');
      setSuccess(action === 'delete' ? 'Usuario eliminado correctamente.' : 'Estado actualizado.');

      // Si se eliminó, limpiar selección
      if (action === 'delete') {
        setSelected(null);
        setDetail(null);
      }

      await search();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el estado.');
    } finally {
      setIsSaving(false);
    }
  };

  const doVerificationAction = async (action: 'approve' | 'reject') => {
    if (!selected) return;
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Debes escribir un motivo de rechazo.');
      return;
    }
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }
      const body: Record<string, unknown> = { user_id: selected.id, action };
      if (action === 'reject') body.rejection_reason = rejectionReason.trim();
      const res = await fetch('/api/admin/users/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar la verificación.');
      setSuccess(action === 'approve' ? '✅ Usuario verificado correctamente.' : '❌ Verificación rechazada. El usuario fue notificado.');
      const newVerified = action === 'approve';
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      setSelected({ ...selected, is_verified: newVerified, verification_status: newStatus });
      setRows((prev) => prev.map((u) => (u.id === selected.id ? { ...u, is_verified: newVerified } : u)));
      setShowRejectInput(false);
      setRejectionReason('');
      if (selected.id) void loadDetail(selected.id);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la verificación.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVerification = async () => {
    if (!selected) return;
    const newVerified = !selected.is_verified;
    await doVerificationAction(newVerified ? 'approve' : 'reject');
  };

  const deleteRating = async (ratingId: string) => {
    setError(null);
    setDeletingRatingId(ratingId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/admin/users/ratings?rating_id=${encodeURIComponent(ratingId)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || 'No se pudo eliminar.');
      setSuccess('Calificación eliminada.');
      if (selected?.id) void loadDetail(selected.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la calificación.');
    } finally {
      setDeletingRatingId(null);
    }
  };

  const saveRatingEdit = async () => {
    if (!editingRating) return;
    setError(null);
    setIsSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/admin/users/ratings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rating_id: editingRating.id,
          stars: Math.max(1, Math.min(10, Number(editStars) || 5)),
          comment: editComment.slice(0, 600),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || 'No se pudo guardar.');
      setSuccess('Calificación actualizada.');
      setEditingRating(null);
      if (selected?.id) void loadDetail(selected.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la calificación.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!selected) {
      console.error('[USUARIOS] No hay usuario seleccionado');
      setError('No hay usuario seleccionado.');
      return;
    }

    const confirmed = confirm(
      '⚠️ ELIMINACIÓN PERMANENTE\n\n' +
      '¿Estás seguro de eliminar esta cuenta?\n\n' +
      'Esto eliminará:\n' +
      '- Todas las publicaciones del usuario\n' +
      '- Todos los cupones del vendedor\n' +
      '- Todos los favoritos\n' +
      '- La cuenta será marcada como eliminada\n\n' +
      '⚠️ Esta acción NO es reversible.\n\n' +
      '¿Continuar?'
    );

    if (!confirmed) {
      console.log('[USUARIOS] Eliminación cancelada por el usuario');
      return;
    }

    console.log('[USUARIOS] Iniciando eliminación de cuenta:', selected.id);
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      if (!token) {
        console.error('[USUARIOS] No hay token de sesión');
        setError('No hay sesión activa. Por favor, inicia sesión nuevamente.');
        window.location.href = '/login?returnTo=/admin/usuarios';
        return;
      }

      console.log('[USUARIOS] Enviando request a API...', { userId: selected.id, notes });

      const res = await fetch('/api/admin/users/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: selected.id, notes }),
      });

      console.log('[USUARIOS] Respuesta recibida:', { status: res.status, ok: res.ok });

      const json = await res.json().catch((parseErr) => {
        console.error('[USUARIOS] Error parseando JSON:', parseErr);
        return { error: 'Error en la respuesta del servidor' };
      });

      console.log('[USUARIOS] JSON respuesta:', json);

      if (!res.ok) {
        const errorMsg = (json as any)?.error || `No se pudo eliminar la cuenta (${res.status}).`;
        console.error('[USUARIOS] Error del servidor:', { status: res.status, error: errorMsg, json });
        throw new Error(errorMsg);
      }

      const deletedListings = (json as any)?.deletedListings ?? 0;
      const successMsg = (json as any)?.message || `Cuenta eliminada completamente. ${deletedListings} publicaciones eliminadas.`;

      console.log('[USUARIOS] ✅ Cuenta eliminada exitosamente:', { deletedListings, message: successMsg });

      setSuccess(successMsg);
      setSelected(null);
      setDetail(null);

      // Recargar lista de usuarios
      await search();
    } catch (e: unknown) {
      console.error('[USUARIOS] Error en deleteAccount:', e);
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-gray-900">Admin · Usuarios</div>
          <div className="mt-1 text-sm text-gray-600">Busca por nombre/nickname/username o por UUID.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/metricas" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Métricas
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-semibold">Error:</div>
          <div className="mt-1">{error}</div>
          <div className="mt-2 text-xs text-red-700">
            Abre la consola del navegador (F12) para ver más detalles.
          </div>
        </div>
      ) : null}
      {success ? <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div> : null}

      {/* Tabs: Todos / Suspendidos */}
      <div className="mt-5 flex gap-2">
        {(['all', 'suspended'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setUserFilter(f); setSelected(null); setDetail(null); }}
            className={`rounded-xl px-4 py-2 text-sm font-bold ring-1 transition-all ${userFilter === f
                ? f === 'suspended'
                  ? 'bg-red-500 text-white ring-red-300'
                  : 'bg-brand-orange text-white ring-pink-200'
                : 'bg-white text-gray-700 ring-black/10 hover:bg-gray-50'
              }`}
          >
            {f === 'all' ? 'Todos' : '🚫 Suspendidos'}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
          placeholder="Ej: armando / alejandra / usuario123 / UUID"
        />
        <button
          type="button"
          onClick={search}
          disabled={isLoading}
          className="shrink-0 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-black/5 px-6 py-4">
            <div className="text-sm font-semibold text-gray-900">{rows.length} resultados</div>
          </div>
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-600">Aún no hay resultados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full divide-y divide-black/5">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Inscripción</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Ventas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Compras</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Ops</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Disputas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Retirado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Cancelación</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Perfil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white">
                  {rows.map((u) => {
                    const st = String(u?.admin_state?.status || 'active');
                    const ventasTotalCount = Number(u?.stats?.ventas_total_count ?? u?.stats?.ventas_count ?? 0) || 0;
                    const comprasTotalCount = Number(u?.stats?.compras_total_count ?? u?.stats?.compras_count ?? 0) || 0;
                    const vCan = Number(u?.stats?.ventas_cancelled_count ?? 0) || 0;
                    const cCan = Number(u?.stats?.compras_cancelled_count ?? 0) || 0;
                    const vRate = cancelRate(vCan, ventasTotalCount);
                    const cRate = cancelRate(cCan, comprasTotalCount);
                    return (
                      <tr
                        key={u.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          setSelected(u);
                          setNotes(String(u?.admin_state?.notes || ''));
                          setShowPassword(false);
                          setEditingRating(null);
                          void loadDetail(u.id);
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">
                              {displayName(u)}
                              {!u.first_name && !u.last_name && !u.full_name && !u.nickname && !u.username && (
                                <span className="ml-2 text-xs font-normal text-gray-400">(Sin nombre)</span>
                              )}
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              {u.email}
                              <span className="mx-1">·</span>
                              <span className="font-mono">{u.id.slice(0, 8)}...</span>
                              <CopyButton text={u.id} size="sm" className="text-gray-400 hover:text-brand-orange" />
                            </div>
                            {(!u.first_name && !u.last_name && !u.full_name && !u.nickname && !u.username && !u.email) && (
                              <div className="mt-1 text-[10px] text-amber-600">
                                ⚠️ Usuario sin datos completos
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900">{fmtDate(u.auth_created_at || u.created_at)}</div>
                          {u.last_sign_in_at ? <div className="mt-1 text-[11px] text-gray-500">Último acceso: {fmtDate(u.last_sign_in_at)}</div> : null}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900">{u.stats?.ventas_count ?? 0}</div>
                          <div className="mt-1 text-[11px] text-gray-500">{formatMoney(Number(u?.stats?.ventas_total ?? 0))}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-700">
                          <div className="font-semibold text-gray-900">{u.stats?.compras_count ?? 0}</div>
                          <div className="mt-1 text-[11px] text-gray-500">{formatMoney(Number(u?.stats?.compras_total ?? 0))}</div>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-gray-900">{u.stats?.operations_count ?? 0}</td>
                        <td className="px-4 py-4 text-xs text-gray-700">
                          <span className="font-semibold text-gray-900">{(u.stats?.disputes_total ?? 0) as number}</span>
                          {((u.stats?.disputes_buyer ?? 0) as number) + ((u.stats?.disputes_seller ?? 0) as number) > 0 ? (
                            <div className="mt-0.5 text-[11px] text-gray-500">B:{(u.stats?.disputes_buyer ?? 0) as number} · V:{(u.stats?.disputes_seller ?? 0) as number}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-gray-900">{formatMoney(Number(u?.stats?.withdrawn_total ?? 0))}</td>
                        <td className="px-4 py-4 text-xs text-gray-700">
                          <div className="text-[11px] text-gray-600">
                            Ventas: <span className="font-semibold text-gray-900">{vCan}</span> / {ventasTotalCount} ({vRate}%)
                          </div>
                          <div className="mt-1 text-[11px] text-gray-600">
                            Compras: <span className="font-semibold text-gray-900">{cCan}</span> / {comprasTotalCount} ({cRate}%)
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          <span
                            className={
                              st === 'deleted'
                                ? 'inline-flex rounded-xl bg-gray-200 px-3 py-2 font-extrabold text-gray-800 ring-1 ring-gray-300'
                                : st === 'banned'
                                  ? 'inline-flex rounded-xl bg-red-50 px-3 py-2 font-extrabold text-red-700 ring-1 ring-red-200'
                                  : st === 'suspended'
                                    ? 'inline-flex rounded-xl bg-amber-50 px-3 py-2 font-extrabold text-amber-900 ring-1 ring-amber-200'
                                    : 'inline-flex rounded-xl bg-green-50 px-3 py-2 font-extrabold text-green-800 ring-1 ring-green-200'
                            }
                          >
                            {st === 'deleted' ? 'Eliminada' : st === 'banned' ? 'Bloqueada' : st === 'suspended' ? 'Suspendida' : 'Activa'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/perfil/${u.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-orange shadow-sm ring-1 ring-pink-200 hover:bg-pink-50"
                          >
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-bold text-gray-900">Ficha</div>
          {!selected ? (
            <div className="mt-3 text-sm text-gray-600">Selecciona un usuario de la lista.</div>
          ) : (
            <>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-gray-900">{displayName(selected)}</div>
                {(detail?.user?.email ?? selected.email) ? (
                  <div className="mt-1 text-sm font-semibold text-gray-700">📧 {detail?.user?.email ?? selected.email}</div>
                ) : null}
                <div className="mt-1 text-xs text-gray-500">{selected.id}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={`/perfil/${selected.id}`}
                    target="_blank"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand-orange shadow-sm ring-1 ring-pink-200 hover:bg-pink-50"
                  >
                    Abrir perfil público →
                  </Link>
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-700">Estado: {currentStateLabel}</div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="rounded-2xl bg-purple-50 px-4 py-3 ring-1 ring-purple-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-purple-900">Monedero (PocketCash)</div>
                      <div className="mt-1 text-lg font-bold text-purple-900">
                        {formatMoney(detail?.user?.wallet_balance ?? selected.wallet_balance ?? 0)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWalletType('credit');
                        setWalletAmount('');
                        setWalletConcept('');
                        setShowWalletModal(true);
                      }}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-sm ring-1 ring-purple-200 hover:bg-purple-50"
                    >
                      Ajustar
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Fecha de inscripción</div>
                  <div className="mt-1 font-bold text-gray-900">
                    {fmtDate(detail?.user?.auth_created_at ?? selected.auth_created_at ?? selected.created_at)}
                  </div>
                  {(detail?.user?.email ?? selected.email) ? (
                    <div className="mt-1 text-xs text-gray-600">
                      Email: <span className="font-semibold text-gray-900">{detail?.user?.email ?? selected.email}</span>
                    </div>
                  ) : null}
                  {(detail?.user?.last_sign_in_at ?? selected.last_sign_in_at) ? (
                    <div className="mt-1 text-xs text-gray-600">
                      Último acceso: <span className="font-semibold text-gray-900">
                        {fmtDate(detail?.user?.last_sign_in_at ?? selected.last_sign_in_at)}
                      </span>
                    </div>
                  ) : null}
                  {selected.encrypted_password ? (
                    <div className="mt-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-600">Contraseña (hash)</div>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-xs font-semibold text-brand-orange hover:opacity-80"
                        >
                          {showPassword ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                      {showPassword ? (
                        <div className="mt-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-[10px] text-gray-700 ring-1 ring-black/10">
                          {selected.encrypted_password}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">••••••••••••••••</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-gray-500">Sin contraseña configurada</div>
                  )}
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Ventas</div>
                  <div className="mt-1 font-bold text-gray-900">
                    {selected.stats?.ventas_count ?? 0} · {formatMoney(Number(selected.stats?.ventas_total ?? 0))}
                  </div>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Compras</div>
                  <div className="mt-1 font-bold text-gray-900">
                    {selected.stats?.compras_count ?? 0} · {formatMoney(Number(selected.stats?.compras_total ?? 0))}
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-600">Dirección de Envío</div>
                    <button
                      onClick={openLocationModal}
                      className="text-[10px] font-bold text-brand-orange hover:underline"
                    >
                      EDITAR
                    </button>
                  </div>
                  <div className="text-xs text-gray-800">
                    {(detail?.user?.profile?.address_street || selected?.address?.address_street) ? (
                      <>
                        <div className="font-semibold">
                          {detail?.user?.profile?.address_street ?? selected?.address?.address_street} {detail?.user?.profile?.ext_number ?? selected?.address?.ext_number}
                          {(detail?.user?.profile?.int_number ?? selected?.address?.int_number) ? ` Int ${detail?.user?.profile?.int_number ?? selected?.address?.int_number}` : ''}
                        </div>
                        <div>{detail?.user?.profile?.neighborhood ?? selected?.address?.neighborhood}</div>
                        <div>{detail?.user?.profile?.city ?? selected?.address?.city}, {detail?.user?.profile?.state ?? selected?.address?.state}</div>
                        <div>CP: {detail?.user?.profile?.zip_code ?? selected?.address?.zip_code}</div>
                        {(detail?.user?.profile?.references ?? selected?.address?.references) && (
                          <div className="mt-1 text-gray-500 italic">Ref: {detail?.user?.profile?.references ?? selected?.address?.references}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 italic">Sin dirección registrada</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50/50 px-4 py-3 ring-1 ring-amber-200/50">
                  <div className="text-sm font-semibold text-amber-900 mb-2">Auditoría y Tienda Oficial</div>

                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-amber-800">Reputación (Manual)</label>
                        <input
                          type="number"
                          value={auditManualReputation}
                          onChange={e => setAuditManualReputation(e.target.value)}
                          placeholder="Ej: 500"
                          className="mt-1 w-full rounded-lg border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-amber-800">Ventas (Manual)</label>
                        <input
                          type="number"
                          value={auditManualSales}
                          onChange={e => setAuditManualSales(e.target.value)}
                          placeholder="Ej: 50"
                          className="mt-1 w-full rounded-lg border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="border-t border-amber-200/50 pt-2 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={auditIsOfficial}
                          onChange={e => setAuditIsOfficial(e.target.checked)}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-amber-900">Es Tienda Oficial</span>
                      </label>
                    </div>

                    {auditIsOfficial && (
                      <div className="pl-4 border-l-2 border-amber-200 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-amber-800">Nombre Tienda Oficial</label>
                          <input
                            value={auditOfficialName}
                            onChange={e => setAuditOfficialName(e.target.value)}
                            placeholder="Nombre de la marca"
                            className="mt-1 w-full rounded-lg border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-amber-800">URL Banner</label>
                          <input
                            value={auditOfficialBanner}
                            onChange={e => setAuditOfficialBanner(e.target.value)}
                            placeholder="https://..."
                            className="mt-1 w-full rounded-lg border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-amber-800">Color de Marca (Hex)</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={auditOfficialColor}
                              onChange={e => setAuditOfficialColor(e.target.value)}
                              className="h-9 w-9 rounded cursor-pointer border-0 p-0"
                            />
                            <input
                              value={auditOfficialColor}
                              onChange={e => setAuditOfficialColor(e.target.value)}
                              placeholder="#000000"
                              className="flex-1 rounded-lg border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Insignias Mayorista / Fabricante */}
                    <div className="flex flex-col gap-2 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={auditIsWholesaler}
                          onChange={e => setAuditIsWholesaler(e.target.checked)}
                          className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-blue-800">🏪 Mayorista Verificado</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={auditIsManufacturer}
                          onChange={e => setAuditIsManufacturer(e.target.checked)}
                          className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                        />
                        <span className="text-sm font-semibold text-pink-800">🏭 Fabricante Verificado</span>
                      </label>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-amber-800">Notas Internas (Persistentes)</label>
                      <textarea
                        value={auditAdminNotes}
                        onChange={e => setAuditAdminNotes(e.target.value)}
                        rows={2}
                        placeholder="Notas solo visibles para admins..."
                        className="mt-1 w-full rounded-lg border-amber-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <button
                      onClick={saveAudit}
                      disabled={isSaving}
                      className="mt-2 w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                    >
                      Guardar Cambios Auditoría
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Cancelaciones</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    Ventas: {Number(selected.stats?.ventas_cancelled_count ?? 0) || 0} / {Number(selected.stats?.ventas_total_count ?? selected.stats?.ventas_count ?? 0) || 0}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    Compras: {Number(selected.stats?.compras_cancelled_count ?? 0) || 0} / {Number(selected.stats?.compras_total_count ?? selected.stats?.compras_count ?? 0) || 0}
                  </div>
                </div>
                {(detail?.user?.stats ?? selected.stats) && (
                  <>
                    <div className="rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                      <div className="text-xs font-semibold text-blue-900">Operaciones</div>
                      <div className="mt-1 font-bold text-blue-900">{(detail?.user?.stats ?? selected.stats)?.operations_count ?? selected.stats?.operations_count ?? 0}</div>
                      <div className="mt-0.5 text-[11px] text-blue-800">ventas + compras (sin canceladas)</div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                      <div className="text-xs font-semibold text-amber-900">Disputas</div>
                      <div className="mt-1 font-bold text-amber-900">
                        {(detail?.user?.stats ?? selected.stats)?.disputes_total ?? selected.stats?.disputes_total ?? 0} total
                        {((detail?.user?.stats ?? selected.stats)?.disputes_open ?? 0) > 0 && (
                          <span className="ml-1 rounded bg-red-200 px-1.5 py-0.5 text-xs text-red-900">
                            {(detail?.user?.stats ?? selected.stats)?.disputes_open ?? 0} abiertas
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-amber-800">
                        comprador: {(detail?.user?.stats ?? selected.stats)?.disputes_buyer ?? selected.stats?.disputes_buyer ?? 0} · vendedor: {(detail?.user?.stats ?? selected.stats)?.disputes_seller ?? selected.stats?.disputes_seller ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-green-50 px-4 py-3 ring-1 ring-green-100">
                      <div className="text-xs font-semibold text-green-900">Dinero retirado</div>
                      <div className="mt-1 font-bold text-green-900">
                        {formatMoney((detail?.user?.stats ?? selected.stats)?.withdrawn_total ?? (selected.stats?.withdrawn_total as number) ?? 0)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-green-800">retiros completados a Mercado Pago</div>
                    </div>
                  </>
                )}
              </div>

              {detailLoading && <div className="mt-3 text-xs text-gray-500">Cargando detalle…</div>}

              {detail?.user?.ratings && detail.user.ratings.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-gray-900">Calificaciones recibidas</div>
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {editingRating ? (
                      <div className="rounded-2xl border border-brand-orange bg-pink-50/50 p-3">
                        <div className="text-xs font-semibold text-gray-700">Editar: {editingRating.rater_name} · {editingRating.stars}/10</div>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={editStars}
                            onChange={(e) => setEditStars(e.target.value)}
                            className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                          />
                          <input
                            type="text"
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            placeholder="Comentario"
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-sm"
                          />
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={saveRatingEdit} disabled={isSaving} className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                            Guardar
                          </button>
                          <button type="button" onClick={() => { setEditingRating(null); setEditComment(''); }} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {detail.user.ratings.map((r: RatingRow) => (
                      <div key={r.id} className="rounded-xl border border-black/5 bg-white px-3 py-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold text-gray-900">{r.rater_name ?? '—'}</span>
                            <span className="ml-1 text-gray-600">· {r.stars}/10</span>
                            {r.direction === 'buyer_to_seller' && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px]">comprador→vendedor</span>}
                            {r.direction === 'seller_to_buyer' && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px]">vendedor→comprador</span>}
                            {r.comment ? <p className="mt-1 text-gray-700">{r.comment}</p> : null}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => { setEditingRating(r); setEditStars(String(r.stars)); setEditComment(r.comment ?? ''); }}
                              className="rounded bg-gray-100 px-2 py-1 font-medium text-gray-700 hover:bg-gray-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRating(r.id)}
                              disabled={deletingRatingId === r.id}
                              className="rounded bg-red-100 px-2 py-1 font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                            >
                              {deletingRatingId === r.id ? '…' : 'Eliminar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900">Verificación de identidad</div>
                {(() => {
                  const p = detail?.user?.profile || {} as any;
                  const frontUrl = p.ine_front_url || selected.ine_front_url;
                  const backUrl = p.ine_back_url || selected.ine_back_url;
                  const selfieUrl = p.selfie_ine_url;
                  const vStatus = p.verification_status || selected.verification_status || 'none';
                  const vReason = p.verification_rejection_reason || selected.verification_rejection_reason || '';
                  const hasAnyDoc = frontUrl || backUrl || selfieUrl;
                  return (
                    <div className="mt-2 space-y-3">
                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${vStatus === 'approved' ? 'bg-green-100 text-green-800 ring-1 ring-green-200' :
                          vStatus === 'pending' ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' :
                            vStatus === 'rejected' ? 'bg-red-100 text-red-800 ring-1 ring-red-200' :
                              'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
                          }`}>
                          {vStatus === 'approved' ? '✅ Aprobado' :
                            vStatus === 'pending' ? '⏳ Pendiente de revisión' :
                              vStatus === 'rejected' ? '❌ Rechazado' :
                                '⚪ Sin verificar'}
                        </span>
                      </div>
                      {vStatus === 'rejected' && vReason && (
                        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                          <strong>Motivo de rechazo:</strong> {vReason}
                        </div>
                      )}

                      {/* Document Thumbnails */}
                      {hasAnyDoc ? (
                        <div className="grid grid-cols-3 gap-3">
                          {frontUrl ? (
                            <div className="cursor-pointer" onClick={() => setVerificationImageModal(frontUrl)}>
                              <div className="text-xs font-medium text-gray-600 mb-1">INE Frente</div>
                              <img src={frontUrl} alt="INE Frente" className="h-24 w-full rounded-lg border border-gray-200 object-cover hover:ring-2 hover:ring-brand-orange transition" />
                            </div>
                          ) : <div className="text-xs text-gray-400">INE Frente: N/A</div>}
                          {backUrl ? (
                            <div className="cursor-pointer" onClick={() => setVerificationImageModal(backUrl)}>
                              <div className="text-xs font-medium text-gray-600 mb-1">INE Reverso</div>
                              <img src={backUrl} alt="INE Reverso" className="h-24 w-full rounded-lg border border-gray-200 object-cover hover:ring-2 hover:ring-brand-orange transition" />
                            </div>
                          ) : <div className="text-xs text-gray-400">INE Reverso: N/A</div>}
                          {selfieUrl ? (
                            <div className="cursor-pointer" onClick={() => setVerificationImageModal(selfieUrl)}>
                              <div className="text-xs font-medium text-gray-600 mb-1">Selfie con INE</div>
                              <img src={selfieUrl} alt="Selfie con INE" className="h-24 w-full rounded-lg border border-gray-200 object-cover hover:ring-2 hover:ring-brand-orange transition" />
                            </div>
                          ) : <div className="text-xs text-gray-400">Selfie: N/A</div>}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No se han subido documentos.</div>
                      )}

                      {/* Approve / Reject Actions (only when pending or for re-review) */}
                      {hasAnyDoc && vStatus !== 'approved' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => doVerificationAction('approve')}
                              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              ✅ Aprobar verificación
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => setShowRejectInput(!showRejectInput)}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                            >
                              ❌ Rechazar
                            </button>
                          </div>
                          {showRejectInput && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Motivo del rechazo (ej: imagen borrosa, no se puede leer el INE...)"
                                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400"
                              />
                              <button
                                type="button"
                                disabled={isSaving || !rejectionReason.trim()}
                                onClick={() => doVerificationAction('reject')}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirmar rechazo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {vStatus === 'approved' && (
                        <div className="text-xs text-green-700">Este usuario ya fue verificado. Para re-verificar, puedes solicitar que suba nuevos documentos.</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900">Plan de suscripción</div>
                <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="text-xs font-semibold text-gray-600">Plan actual</div>
                      <div className="mt-1 text-sm font-bold text-gray-900 uppercase">
                        {detail?.user?.profile?.plan_type || 'basic'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updatePlan('basic')}
                        disabled={isSaving || (detail?.user?.profile?.plan_type === 'basic' || !detail?.user?.profile?.plan_type)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Basic
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePlan('pro')}
                        disabled={isSaving || detail?.user?.profile?.plan_type === 'pro'}
                        className="rounded-xl bg-gradient-to-r from-brand-orange to-pink-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                      >
                        PRO
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePlan('platinum')}
                        disabled={isSaving || detail?.user?.profile?.plan_type === 'platinum'}
                        className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                      >
                        ⭐ Platinum
                      </button>
                    </div>
                  </div>

                  {(detail?.user?.profile?.plan_type === 'pro' || detail?.user?.profile?.plan_type === 'platinum') && (
                    <div className="border-t border-gray-200 pt-2 w-full">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>Inicio: <span className="font-medium text-gray-900">{fmtDate(detail.user.profile.pro_subscription_start)}</span></div>
                          <div>Fin: <span className="font-medium text-gray-900">{fmtDate(detail.user.profile.pro_subscription_end)}</span></div>
                        </div>
                        <button
                          type="button"
                          onClick={openPlanDatesModal}
                          className="text-xs font-semibold text-brand-orange hover:underline"
                        >
                          Editar Vigencia
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900">Verificación</div>
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Usuario verificado</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {selected.is_verified ? 'Este usuario tiene la insignia de verificado' : 'Este usuario no está verificado'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleVerification}
                    disabled={isSaving}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-60 ${selected.is_verified
                      ? 'bg-white text-gray-900 ring-1 ring-black/5 hover:bg-gray-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    {selected.is_verified ? 'Quitar verificación' : 'Verificar usuario'}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900">Notas del administrador</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="Ej: historial de disputas, comportamiento, acuerdos…"
                />
                <div className="mt-3 grid gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={suspendDays}
                      onChange={(e) => setSuspendDays(e.target.value)}
                      className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                      inputMode="numeric"
                      placeholder="Días"
                    />
                    <button
                      type="button"
                      onClick={() => applyState('suspend')}
                      disabled={isSaving}
                      className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Suspender
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyState('activate')}
                    disabled={isSaving}
                    className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                  >
                    Activar cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => applyState('ban')}
                    disabled={isSaving}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
                  >
                    Bloqueo permanente
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[USUARIOS] Botón Eliminar cuenta clickeado');
                      void applyState('delete');
                    }}
                    disabled={isSaving || !selected}
                    className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Eliminando…' : 'Eliminar cuenta'}
                  </button>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  Suspender/Bloquear afecta listados. Eliminar cuenta = eliminación permanente (NO reversible). Se eliminan todas las publicaciones, cupones y favoritos del usuario.
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/perfil/${selected.id}`}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                >
                  Ver perfil
                </Link>
                <Link
                  href={`/tienda/${selected.id}`}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                >
                  Ver tienda
                </Link>
                <Link
                  href={`/admin/supervision?seller_id=${selected.id}`}
                  className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100"
                >
                  Supervisión (vendedor)
                </Link>
                <Link
                  href={`/admin/supervision?buyer_id=${selected.id}`}
                  className="rounded-xl bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100"
                >
                  Supervisión (comprador)
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setImpersonationPassword('');
                    setShowImpersonateModal(true);
                  }}
                  className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  Impersonar usuario
                </button>
                <Link
                  href="/admin/disputas"
                  className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                >
                  Disputas
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plan Dates Modal */}
      {showPlanDatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Vigencia Plan PRO</h3>
              <p className="text-xs text-gray-500">Ajusta las fechas de inicio y fin de la suscripción.</p>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Fecha Inicio</label>
                <input
                  type="datetime-local"
                  value={planStart}
                  onChange={e => setPlanStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Fecha Fin (Vencimiento)</label>
                <input
                  type="datetime-local"
                  value={planEnd}
                  onChange={e => setPlanEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setShowPlanDatesModal(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={savePlanDates}
                disabled={isSaving}
                className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar Fechas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImpersonateModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Impersonar usuario</h3>
              <p className="text-xs text-gray-500">
                Ingresas a Pocket como este usuario para depurar problemas reales. Requiere tu contraseña de admin.
              </p>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="text-xs text-gray-700">
                Usuario objetivo:{' '}
                <span className="font-semibold">
                  {displayName(selected)} ({selected.id})
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Tu contraseña de administrador</label>
                <input
                  type="password"
                  value={impersonationPassword}
                  onChange={(e) => setImpersonationPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  placeholder="••••••••"
                />
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                Se abrirá el dashboard del usuario en una nueva pestaña. Cierra la pestaña cuando termines.
              </div>
            </div>
            <div className="flex justify-end gap-3 bg-gray-50 px-6 py-4">
              <button
                onClick={() => {
                  if (isImpersonatingRequest) return;
                  setShowImpersonateModal(false);
                  setImpersonationPassword('');
                }}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleStartImpersonation}
                disabled={isImpersonatingRequest}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {isImpersonatingRequest ? 'Verificando…' : 'Impersonar ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Editar Ubicación</h3>
              <p className="text-xs text-gray-500">Actualiza la dirección del usuario. Usa el CP para autocompletar.</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Código Postal</label>
                    <input
                      value={locZip}
                      onChange={(e) => setLocZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                      placeholder="00000"
                    />
                  </div>
                  <button
                    onClick={handleZipLookup}
                    type="button"
                    className="mb-[1px] rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Validar (SEPOMEX)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Estado</label>
                    <input
                      value={locState}
                      onChange={(e) => setLocState(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Municipio/Ciudad</label>
                    <input
                      value={locCity}
                      onChange={(e) => setLocCity(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700">Colonia</label>
                  {locColonies.length > 0 ? (
                    <select
                      value={locColony}
                      onChange={(e) => setLocColony(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    >
                      <option value="">Selecciona una colonia...</option>
                      {locColonies.map((c, i) => (
                        <option key={i} value={c.nombre}>{c.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={locColony}
                      onChange={(e) => setLocColony(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                      placeholder="Nombre de la colonia"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700">Calle</label>
                  <input
                    value={locStreet}
                    onChange={(e) => setLocStreet(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">No. Exterior</label>
                    <input
                      value={locExt}
                      onChange={(e) => setLocExt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">No. Interior</label>
                    <input
                      value={locInt}
                      onChange={(e) => setLocInt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700">Referencias</label>
                  <textarea
                    value={locRefs}
                    onChange={(e) => setLocRefs(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700">Entre calles</label>
                  <textarea
                    value={locCross}
                    onChange={(e) => setLocCross(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setShowLocationModal(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveLocation}
                disabled={isSaving}
                className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar Ubicación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <h3 className="text-lg font-bold text-gray-900">Ajustar Saldo de Monedero</h3>
            <p className="mt-1 text-sm text-gray-600">
              Usuario: <span className="font-semibold">{selected ? displayName(selected) : ''}</span>
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Tipo de movimiento</label>
                <div className="mt-2 flex rounded-xl bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setWalletType('credit')}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${walletType === 'credit' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Abonar (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletType('debit')}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-all ${walletType === 'debit' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Descontar (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Monto (MXN)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="mt-1 block w-full rounded-xl border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Concepto (Razón)</label>
                <input
                  type="text"
                  value={walletConcept}
                  onChange={(e) => setWalletConcept(e.target.value)}
                  className="mt-1 block w-full rounded-xl border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-brand-orange focus:ring-brand-orange"
                  placeholder="Ej: Bonificación por compra, Corrección manual..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleWalletAdjust}
                disabled={isSaving}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${walletType === 'credit' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {isSaving ? 'Guardando...' : walletType === 'credit' ? 'Abonar Saldo' : 'Descontar Saldo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size image modal for verification docs */}
      {verificationImageModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVerificationImageModal(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              type="button"
              onClick={() => setVerificationImageModal(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-900 shadow-lg hover:bg-gray-100"
            >
              ✕
            </button>
            <img
              src={verificationImageModal}
              alt="Documento de verificación"
              className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

