'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Pagination, usePagination } from '@/components/ui/Pagination';

function formatMoney(v: number) {
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
// ... keep helpers

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type EstafetaQuote = {
  id: string;
  user_id: string;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  sender_name: string;
  sender_phone: string;
  sender_email: string;
  sender_between_streets?: string;
  sender_references?: string;
  sender_address: string;
  sender_city: string;
  sender_state: string;
  sender_postal_code: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  recipient_between_streets?: string;
  recipient_references?: string;
  recipient_address: string;
  recipient_city: string;
  recipient_state: string;
  recipient_postal_code: string;
  calculated_cost: number;
  status: string;
  mp_payment_id: string | null;
  mp_payment_status: string | null;
  guide_file_url: string | null;
  guide_uploaded_at: string | null;
  guide_uploaded_by: string | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
};

export default function AdminEstafetaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando envíos...</div>}>
      <AdminEstafetaContent />
    </Suspense>
  );
}

function AdminEstafetaContent() {
  const searchParams = useSearchParams();
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<EstafetaQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<EstafetaQuote | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingQuoteId, setUploadingQuoteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>((searchParams.get('status') as string) || 'paid_without_guide');

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setFilterStatus(s);
  }, [searchParams]);

  const [searchTerm, setSearchTerm] = useState(''); // Estado para búsqueda

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/login?returnTo=/admin/estafeta';
          return;
        }

        // Verificar que es admin
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (!adminRow) {
          window.location.href = '/dashboard';
          return;
        }

        await loadQuotes();
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el panel.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadQuotes = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/admin/estafeta/list?status=all&_t=${Date.now()}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar las cotizaciones.');

      setQuotes((json?.quotes ?? []) as EstafetaQuote[]);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las cotizaciones.');
    }
  };

  useEffect(() => {
    if (!isBooting) {
      void loadQuotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleFileUpload = async (quoteId: string, file: File) => {
    setError(null);
    setSuccess(null);
    setUploadingFile(true);
    setUploadingQuoteId(quoteId);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Sesión no válida.');

      // Send file to server via FormData — server handles storage upload with admin credentials
      const formData = new FormData();
      formData.append('file', file);
      formData.append('quote_id', quoteId);

      const res = await fetch('/api/admin/estafeta/upload-guide', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo subir la guía.');

      setSuccess('✅ Guía subida correctamente. El usuario podrá descargarla desde "Mis Guías Estafeta".');
      await loadQuotes();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir la guía.');
    } finally {
      setUploadingFile(false);
      setUploadingQuoteId(null);
    }
  };

  const downloadDataFile = (quote: EstafetaQuote) => {
    const data = {
      'ID Cotización': quote.id,
      'Fecha de creación': formatDateTime(quote.created_at),
      'Estado': quote.status,
      'Costo': formatMoney(quote.calculated_cost),
      'Pago MercadoPago ID': quote.mp_payment_id || 'N/A',
      'Estado de pago': quote.mp_payment_status || 'N/A',
      'Fecha de pago': quote.paid_at ? formatDateTime(quote.paid_at) : 'N/A',
      '=== DATOS DEL PAQUETE ===': '',
      'Peso (kg)': quote.weight_kg,
      'Largo (cm)': quote.length_cm,
      'Ancho (cm)': quote.width_cm,
      'Alto (cm)': quote.height_cm,
      '=== DATOS DEL REMITENTE ===': '',
      'Remitente - Nombre': quote.sender_name,
      'Remitente - Teléfono': quote.sender_phone,
      'Remitente - Email': quote.sender_email,
      'Remitente - Dirección': quote.sender_address,
      'Remitente - Entre calles': quote.sender_between_streets || '',
      'Remitente - Referencias': quote.sender_references || '',
      'Remitente - Ciudad': quote.sender_city,
      'Remitente - Estado': quote.sender_state,
      'Remitente - Código postal': quote.sender_postal_code,
      '=== DATOS DEL DESTINATARIO ===': '',
      'Destinatario - Nombre': quote.recipient_name,
      'Destinatario - Teléfono': quote.recipient_phone,
      'Destinatario - Email': quote.recipient_email,
      'Destinatario - Dirección': quote.recipient_address,
      'Destinatario - Entre calles': quote.recipient_between_streets || '',
      'Destinatario - Referencias': quote.recipient_references || '',
      'Destinatario - Ciudad': quote.recipient_city,
      'Destinatario - Estado': quote.recipient_state,
      'Destinatario - Código postal': quote.recipient_postal_code,
    };

    const content = Object.entries(data)
      .map(([key, value]) => {
        if (key.startsWith('===')) {
          return `\n${key}\n${value}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estafeta-quote-${quote.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const paidQuotesWithoutGuide = useMemo(() =>
    quotes.filter(q => (q.status === 'paid' || q.status === 'processing') && !q.guide_file_url),
    [quotes]);

  const paidQuotes = useMemo(() => quotes.filter(q => q.status === 'paid'), [quotes]);
  const pendingQuotes = useMemo(() => quotes.filter(q => q.status === 'pending_payment'), [quotes]);
  const completedQuotes = useMemo(() => quotes.filter(q => q.status === 'completed'), [quotes]);

  const filteredQuotes = useMemo(() => {
    let result = quotes;

    // 1. Filtro de estado
    if (filterStatus === 'paid_without_guide') {
      result = paidQuotesWithoutGuide;
    } else if (filterStatus !== 'all') {
      result = result.filter(q => q.status === filterStatus);
    }

    // 2. Filtro de búsqueda de texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(q => {
        const id = String(q.id || '').toLowerCase();
        const sender = String(q.sender_name || '').toLowerCase();
        const recipient = String(q.recipient_name || '').toLowerCase();
        const emailSender = String(q.sender_email || '').toLowerCase();
        const emailRecipient = String(q.recipient_email || '').toLowerCase();
        const mpId = String(q.mp_payment_id || '').toLowerCase();

        return (
          id.includes(term) ||
          sender.includes(term) ||
          recipient.includes(term) ||
          emailSender.includes(term) ||
          emailRecipient.includes(term) ||
          mpId.includes(term)
        );
      });
    }

    return result;
  }, [quotes, filterStatus, searchTerm, paidQuotesWithoutGuide]);

  const { paginatedItems: paginatedQuotes, paginationProps: quotesPagination, setCurrentPage: setQuotesPage } = usePagination(filteredQuotes, 50);
  useEffect(() => { setQuotesPage(1); }, [filterStatus, searchTerm, setQuotesPage]);

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
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
              <div className="text-sm font-semibold text-gray-900">Tienda Estafeta</div>
              <div className="text-xs text-gray-500">Gestiona las ventas de guías de envío</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/metricas" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Métricas
            </Link>
            <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Configuración
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Tienda Estafeta</h1>
              <p className="mt-1 text-sm text-gray-600">Gestiona las compras de guías de envío y sube las guías cuando estén listas</p>
            </div>
          </div>

          {/* Resumen */}
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs font-semibold text-gray-600">Total cotizaciones</div>
              <div className="mt-1 text-xl font-extrabold text-gray-900">{quotes.length}</div>
            </div>
            <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 ring-2 ring-red-200">
              <div className="text-xs font-semibold text-red-700">⚠️ Pendientes de subir</div>
              <div className="mt-1 text-xl font-extrabold text-red-900">{paidQuotesWithoutGuide.length}</div>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xs font-semibold text-green-700">Pagadas</div>
              <div className="mt-1 text-xl font-extrabold text-green-900">{paidQuotes.length}</div>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
              <div className="text-xs font-semibold text-purple-700">Completadas</div>
              <div className="mt-1 text-xl font-extrabold text-purple-900">{completedQuotes.length}</div>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('paid_without_guide')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filterStatus === 'paid_without_guide' ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
            >
              ⚠️ Pendientes de subir ({paidQuotesWithoutGuide.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filterStatus === 'all' ? 'bg-brand-emerald text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Todas ({quotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending_payment')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filterStatus === 'pending_payment' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Pendientes de pago ({pendingQuotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('paid')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filterStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Pagadas ({paidQuotes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('processing')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filterStatus === 'processing' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Procesando
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${filterStatus === 'completed' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Completadas ({completedQuotes.length})
            </button>
          </div>

          {/* Lista de cotizaciones */}
          {filteredQuotes.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">No hay cotizaciones que coincidan con este filtro.</div>
          ) : (
            <>
              <div className="mt-6 space-y-4">
                {paginatedQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        {/* Banner destacado cuando el pago está acreditado */}
                        {quote.status === 'paid' && quote.paid_at && (
                          <div className="mb-4 rounded-xl border-2 border-green-500 bg-green-50 p-4">
                            <div className="flex items-center gap-2">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-600">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              <div className="flex-1">
                                <div className="text-sm font-extrabold text-green-900">✓ Pago Acreditado</div>
                                <div className="mt-1 text-xs text-green-800">
                                  Vendido y pagado el: <span className="font-semibold">{formatDateTime(quote.paid_at)}</span>
                                </div>
                                {quote.mp_payment_id && (
                                  <div className="mt-1 text-[10px] text-green-700 font-mono">
                                    ID MercadoPago: {quote.mp_payment_id}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <div className="group relative flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1 text-xs font-extrabold text-white transition-colors hover:bg-gray-800">
                            <span>{quote.id.slice(0, 8)}…</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(quote.id);
                                const el = document.getElementById(`qid-${quote.id}`);
                                if (el) {
                                  const original = el.innerText;
                                  el.innerText = '📋';
                                  setTimeout(() => {
                                    el.innerText = original;
                                  }, 1000);
                                }
                              }}
                              className="ml-1 opacity-50 hover:opacity-100 focus:outline-none"
                              title="Copiar ID"
                            >
                              <span id={`qid-${quote.id}`}>📋</span>
                            </button>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${quote.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : quote.status === 'pending_payment'
                                ? 'bg-blue-100 text-blue-800'
                                : quote.status === 'completed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : quote.status === 'processing'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {quote.status === 'paid' ? 'Pagada' :
                              quote.status === 'pending_payment' ? 'Pendiente de pago' :
                                quote.status === 'completed' ? 'Completada' :
                                  quote.status === 'processing' ? 'Procesando' :
                                    quote.status}
                          </span>
                          <span className="text-xs text-gray-500">Creada: {formatDateTime(quote.created_at)}</span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="text-xs font-semibold text-gray-600">Paquete</div>
                            <div className="mt-1 text-sm text-gray-900">
                              {quote.weight_kg} kg · {quote.length_cm}×{quote.width_cm}×{quote.height_cm} cm
                            </div>
                            <div className="mt-2 text-lg font-extrabold text-brand-emerald">{formatMoney(quote.calculated_cost)}</div>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="text-xs font-semibold text-gray-600">Remitente</div>
                            <div className="mt-1 text-sm font-semibold text-gray-900">{quote.sender_name}</div>
                            <div className="mt-1 text-xs text-gray-600">
                              {quote.sender_city}, {quote.sender_state} {quote.sender_postal_code}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">{quote.sender_phone}</div>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="text-xs font-semibold text-gray-600">Destinatario</div>
                            <div className="mt-1 text-sm font-semibold text-gray-900">{quote.recipient_name}</div>
                            <div className="mt-1 text-xs text-gray-600">
                              {quote.recipient_city}, {quote.recipient_state} {quote.recipient_postal_code}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">{quote.recipient_phone}</div>
                          </div>

                          {quote.mp_payment_id && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="text-xs font-semibold text-gray-600">Pago MercadoPago</div>
                              <div className="mt-1 text-xs font-mono text-gray-900">{quote.mp_payment_id}</div>
                              {quote.mp_payment_status && (
                                <div className="mt-1 text-xs text-gray-600">Estado: {quote.mp_payment_status}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 lg:w-64">
                        {/* Botón de upload destacado cuando el pago está acreditado */}
                        {quote.status === 'paid' && !quote.guide_file_url && (
                          <label className="w-full cursor-pointer rounded-xl bg-green-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-green-700 transition-all border-2 border-green-700">
                            <div className="flex items-center justify-center gap-2">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              <span>{uploadingFile && uploadingQuoteId === quote.id ? 'Subiendo...' : 'Subir Guía'}</span>
                            </div>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleFileUpload(quote.id, file);
                                }
                              }}
                              disabled={uploadingFile}
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          onClick={() => downloadDataFile(quote)}
                          className="w-full rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black"
                        >
                          Descargar datos (.txt)
                        </button>

                        {quote.guide_file_url && (
                          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-center">
                            <div className="text-xs font-semibold text-green-900">✓ Guía subida</div>
                            <div className="mt-1 text-[10px] text-green-700">
                              {quote.guide_uploaded_at ? formatDateTime(quote.guide_uploaded_at) : 'N/A'}
                            </div>
                            <a
                              href={quote.guide_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block rounded-lg bg-green-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-green-700"
                            >
                              Ver guía
                            </a>
                          </div>
                        )}

                        {quote.status === 'paid' && !quote.guide_file_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { data: sess } = await supabase.auth.getSession();
                                if (sess.session) {
                                  const res = await fetch('/api/admin/estafeta/mark-processing', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json', authorization: `Bearer ${sess.session.access_token}` },
                                    body: JSON.stringify({ quote_id: quote.id }),
                                  });
                                  if (res.ok) {
                                    await loadQuotes();
                                  }
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="w-full rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
                          >
                            Marcar como procesando
                          </button>
                        )}

                        {quote.status === 'processing' && quote.guide_file_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { data: sess } = await supabase.auth.getSession();
                                if (sess.session) {
                                  const res = await fetch('/api/admin/estafeta/mark-completed', {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json', authorization: `Bearer ${sess.session.access_token}` },
                                    body: JSON.stringify({ quote_id: quote.id }),
                                  });
                                  if (res.ok) {
                                    await loadQuotes();
                                  }
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="w-full rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700"
                          >
                            Marcar como completada
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination {...quotesPagination} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
