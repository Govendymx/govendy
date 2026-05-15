'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PaymentDeadlineWarning from '@/components/common/PaymentDeadlineWarning';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatMoney(v: number) {
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function PagoOfflinePage() {
  const params = useParams<{ checkoutId: string }>();
  const checkoutId = String((params as any)?.checkoutId || '').trim();

  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [viewerId, setViewerId] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const session = data?.session ?? null;
  const orders = (data?.orders ?? []) as any[];
  const items = data?.items ?? null;

  const method = String(session?.payment_method || '');
  const reference = String(session?.reference_code || '');
  const amount = toNumber(session?.amount);
  const createdAt = session?.created_at ? new Date(session.created_at).toLocaleString('es-MX') : '—';
  const proofUrl = String(session?.payment_proof_url || '').trim();
  const proofUploadedAt = session?.payment_proof_uploaded_at ? new Date(session.payment_proof_uploaded_at).toLocaleString('es-MX') : '';
  const canUploadProof = !!viewerId && !!session && String(session?.buyer_id || '') === viewerId;

  const instructions = useMemo(() => {
    const snap = session?.offline_instructions ?? null;
    if (snap) return snap;
    const pm = data?.payment_methods ?? {};
    if (method === 'bank_transfer') return pm?.bank_transfer ?? {};
    if (method === 'bank_deposit') return pm?.bank_deposit ?? {};
    if (method === 'oxxo') return pm?.oxxo ?? {};
    return {};
  }, [data, method, session?.offline_instructions]);

  const labelMethod = useMemo(() => {
    if (method === 'bank_transfer') return 'Transferencia bancaria';
    if (method === 'bank_deposit') return 'Depósito bancario';
    if (method === 'oxxo') return 'OXXO';
    return method || 'Pago offline';
  }, [method]);

  const grouped = useMemo(() => {
    const list = (items ?? []) as any[];
    const by: Record<string, any[]> = {};
    for (const it of list) {
      const oid = String(it?.order_id || '');
      if (!oid) continue;
      if (!by[oid]) by[oid] = [];
      by[oid].push(it);
    }
    return by;
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        if (!checkoutId) throw new Error('checkoutId inválido.');

        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          window.location.href = `/login?returnTo=${encodeURIComponent(`/pago/${checkoutId}`)}`;
          return;
        }

        try {
          const u = await supabase.auth.getUser();
          const id = String(u?.data?.user?.id || '').trim();
          if (!cancelled) setViewerId(id);
        } catch {
          if (!cancelled) setViewerId('');
        }

        const res = await fetch(`/api/offline-payment/details?checkoutId=${encodeURIComponent(checkoutId)}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudo cargar la hoja de pago.');
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la hoja de pago.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [checkoutId]);

  const uploadProof = async (file: File) => {
    setProofError(null);
    setProofSuccess(null);
    setIsUploadingProof(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/login?returnTo=${encodeURIComponent(`/pago/${checkoutId}`)}`;
        return;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'payment_proof');

      const up = await fetch('/api/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      const upJson = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upJson?.error || 'No se pudo subir el comprobante.');
      const url = String(upJson?.url || '').trim();
      if (!url) throw new Error('No se pudo obtener la URL del comprobante.');

      const save = await fetch('/api/offline-payment/proof', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkoutId, proofUrl: url }),
      });
      const saveJson = await save.json().catch(() => ({}));
      if (!save.ok) throw new Error(saveJson?.error || 'No se pudo guardar el comprobante.');

      setProofSuccess('Comprobante subido. El admin lo revisará para validar tu pago.');

      // Refrescar detalles (para que aparezca la imagen/fecha sin recargar la página)
      const res = await fetch(`/api/offline-payment/details?checkoutId=${encodeURIComponent(checkoutId)}&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json);
    } catch (e: unknown) {
      console.error(e);
      setProofError(e instanceof Error ? e.message : 'No se pudo subir el comprobante.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadPdf = () => {
    if (!session) return;
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      // Header
      doc.setFillColor(227, 18, 125);
      doc.rect(0, 0, 595, 70, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('GoVendy', 40, 42);
      doc.setFontSize(12);
      doc.text('Hoja de pago (offline)', 120, 42);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Método: ${labelMethod}`, 40, 95);
      doc.text(`Fecha: ${createdAt}`, 40, 113);
      doc.setTextColor(227, 18, 125);
      doc.setFontSize(14);
      doc.text(`Concepto / Referencia: ${reference || '—'}`, 40, 138);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Total a pagar: ${formatMoney(amount)}`, 40, 160);

      // Instrucciones / Datos
      const lines: string[] = [];
      if (method === 'bank_transfer') {
        if (instructions?.bank_name) lines.push(`Banco: ${instructions.bank_name}`);
        if (instructions?.account_holder) lines.push(`Titular: ${instructions.account_holder}`);
        if (instructions?.clabe) lines.push(`CLABE: ${instructions.clabe}`);
      } else if (method === 'bank_deposit') {
        if (instructions?.bank_name) lines.push(`Banco: ${instructions.bank_name}`);
        if (instructions?.account_holder) lines.push(`Titular: ${instructions.account_holder}`);
        if (instructions?.account_number) lines.push(`Cuenta: ${instructions.account_number}`);
      }
      if (instructions?.instructions) lines.push(String(instructions.instructions));

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('Datos de pago:', 40, 190);
      doc.setTextColor(80, 80, 80);
      const wrapped = doc.splitTextToSize(lines.length ? lines.join('\n') : 'Consulta las instrucciones en esta hoja.', 515);
      doc.text(wrapped, 40, 208);

      // Tabla de artículos
      const tableBody: any[] = [];
      for (const o of orders) {
        const oid = String(o?.id || '');
        const its = grouped[oid] ?? [];
        for (const it of its) {
          tableBody.push([
            String(it?.title || 'Artículo'),
            String(it?.quantity ?? 1),
            formatMoney(toNumber(it?.unit_price)),
            formatMoney(toNumber(it?.line_total)),
          ]);
        }
      }

      autoTable(doc, {
        startY: 290,
        head: [['Artículo', 'Cant.', 'Precio', 'Importe']],
        body: tableBody.length ? tableBody : [['(Sin items)', '', '', '']],
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [227, 18, 125], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      });

      const y = (doc as any).lastAutoTable?.finalY ? Number((doc as any).lastAutoTable.finalY) + 18 : 520;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(`Total a pagar: ${formatMoney(amount)}`, 40, y);
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
      doc.text(`ID de sesión: ${checkoutId}`, 40, y + 16);
      doc.text('GoVendy · Guarda tu comprobante. Si necesitas ayuda, contacta soporte desde “Mi cuenta”.', 40, y + 32);

      doc.save(`GoVendy-PAGO-${reference || checkoutId}.pdf`);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-orange border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Cargando detalles del pago...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] pb-20">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange font-bold">
              GP
            </div>
            <span className="font-semibold text-gray-900">GoVendy</span>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Cerrar
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">⚠️</div>
            <h3 className="mt-4 text-lg font-bold text-red-900">Error</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-white px-6 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 mb-4">
                {labelMethod}
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">{formatMoney(amount)}</h1>
              <p className="mt-2 text-sm text-gray-500">Total a pagar</p>
              
              <PaymentDeadlineWarning createdAt={session?.created_at} className="mt-6 max-w-lg mx-auto text-left" />
            </div>

            <div className="space-y-6">
              {/* Concepto / Referencia - THE MOST IMPORTANT PART */}
              <div className="rounded-3xl bg-white p-1 shadow-sm ring-1 ring-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-brand-orange to-pink-600 px-6 py-6 text-white text-center rounded-t-[20px]">
                  <p className="text-sm font-medium opacity-90 mb-1">Concepto / Referencia</p>
                  <p className="text-xs opacity-75">Incluye este código en tu transferencia</p>
                </div>
                <div className="px-6 py-6 text-center">
                  <div 
                    onClick={() => copyToClipboard(reference || '', 'ref')}
                    className="group cursor-pointer relative inline-block"
                  >
                    <div className="text-2xl sm:text-3xl font-mono font-bold text-gray-900 tracking-wider break-all">
                      {reference || '—'}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-brand-orange flex items-center justify-center gap-1 group-hover:underline">
                      {copied === 'ref' ? (
                        <span className="text-green-600">¡Copiado!</span>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                          Copiar referencia
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-left">
                    <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p className="text-[11px] leading-relaxed text-blue-700 font-medium">
                      Referencia únicamente como control de seguridad interno y para verificar tu pago más rápidamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank Details Card */}
              <div className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                  <h3 className="font-bold text-gray-900">Datos bancarios</h3>
                </div>
                <div className="p-6 space-y-5">
                  {(method === 'bank_transfer' || method === 'bank_deposit') && instructions?.bank_name && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Banco Destino</label>
                      <div className="mt-1 text-lg font-medium text-gray-900">{instructions.bank_name}</div>
                    </div>
                  )}

                  {(method === 'bank_transfer' || method === 'bank_deposit') && instructions?.account_holder && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Beneficiario / Titular</label>
                      <div className="mt-1 text-lg font-medium text-gray-900">{instructions.account_holder}</div>
                    </div>
                  )}

                  {method === 'bank_transfer' && instructions?.clabe && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">CLABE Interbancaria</label>
                      <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                        <span className="font-mono text-lg font-medium text-gray-900 truncate">{instructions.clabe}</span>
                        <button 
                          onClick={() => copyToClipboard(instructions.clabe, 'clabe')}
                          className="shrink-0 p-2 text-gray-400 hover:text-brand-orange transition-colors"
                        >
                          {copied === 'clabe' ? (
                            <span className="text-xs font-bold text-green-600">Copiado</span>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {method === 'bank_deposit' && instructions?.account_number && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Número de Cuenta</label>
                      <div className="mt-1 flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                        <span className="font-mono text-lg font-medium text-gray-900 truncate">{instructions.account_number}</span>
                        <button 
                          onClick={() => copyToClipboard(instructions.account_number, 'acc')}
                          className="shrink-0 p-2 text-gray-400 hover:text-brand-orange transition-colors"
                        >
                          {copied === 'acc' ? (
                            <span className="text-xs font-bold text-green-600">Copiado</span>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {instructions?.instructions && (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {String(instructions.instructions)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Proof Section */}
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Comprobante de pago</h3>
                  {proofUploadedAt && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Subido el {proofUploadedAt}</span>}
                </div>
                
                <p className="text-sm text-gray-500 mb-4">
                  Sube una foto clara de tu ticket o captura de pantalla para que podamos verificar tu pago rápidamente.
                </p>

                {proofError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{proofError}</div>}
                {proofSuccess && <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{proofSuccess}</div>}

                <div className="space-y-4">
                  {canUploadProof ? (
                    <label className={`
                      relative flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed transition-all cursor-pointer
                      ${isUploadingProof ? 'bg-gray-50 border-gray-300 opacity-50' : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-brand-orange'}
                    `}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isUploadingProof ? (
                           <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                        ) : (
                          <>
                            <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            <p className="text-sm text-gray-500"><span className="font-semibold">Toca para subir</span> o arrastra aquí</p>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        disabled={isUploadingProof}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadProof(f);
                        }}
                      />
                    </label>
                  ) : (
                    <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
                      Solo el comprador original puede subir el comprobante.
                    </div>
                  )}

                  {proofUrl && (
                    <div className="relative rounded-2xl overflow-hidden ring-1 ring-black/10 bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proofUrl} alt="Comprobante" className="w-full h-auto object-contain max-h-96" />
                      <div className="absolute top-2 right-2">
                        <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm hover:bg-white">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                          Ver original
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={downloadPdf}
                  className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Descargar Instrucciones (PDF)
                </button>
                <Link 
                  href="/dashboard"
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 text-center"
                >
                  Volver al Dashboard
                </Link>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
