'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';

type MailboxItem = { index: number; label: string; email: string };
type InboxEmail = { uid: number; from: string; to: string; subject: string; date: string; seen?: boolean };
type FullEmail = { from: string; to: string; subject: string; date?: string; text?: string; html?: string };

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminCorreoPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);
  const [account, setAccount] = useState(0);
  const [page, setPage] = useState(1);
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<{ uid: number } | null>(null);
  const [fullEmail, setFullEmail] = useState<FullEmail | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEmails = useMemo(() => {
    if (!searchTerm.trim()) return emails;
    const term = searchTerm.toLowerCase();
    return emails.filter((e) => {
      const from = (e.from || '').toLowerCase();
      const subject = (e.subject || '').toLowerCase();
      return from.includes(term) || subject.includes(term);
    });
  }, [emails, searchTerm]);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return (data?.session?.access_token ?? '') as string;
  };

  const loadConfig = async () => {
    const t = await getToken();
    if (!t) return;
    const res = await fetch('/api/admin/mail/config', { headers: { authorization: `Bearer ${t}` }, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Error al cargar configuración');
    setMailboxes((json?.mailboxes ?? []) as MailboxItem[]);
  };

  const loadInbox = async () => {
    setError(null);
    setLoading(true);
    try {
      const t = await getToken();
      if (!t) return;
      const selectedEmail = mailboxes[account]?.email || '';
      const toParam = selectedEmail ? `&to=${encodeURIComponent(selectedEmail)}` : '';
      const res = await fetch(
        `/api/admin/mail/inbox?account=${account}&page=${page}&limit=25${toParam}&t=${Date.now()}`,
        { headers: { authorization: `Bearer ${t}` }, cache: 'no-store' }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error al cargar buzón');
      setEmails((json?.emails ?? []) as InboxEmail[]);
      setTotal(Number(json?.total ?? 0));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmail = async (uid: number) => {
    setSelected({ uid });
    setFullEmail(null);
    setLoadingEmail(true);
    setError(null);
    try {
      const t = await getToken();
      if (!t) return;
      const res = await fetch(`/api/admin/mail/email?account=${account}&uid=${uid}`, {
        headers: { authorization: `Bearer ${t}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error al cargar correo');
      setFullEmail((json?.email ?? null) as FullEmail | null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoadingEmail(false);
    }
  };

  const sendEmail = async () => {
    setError(null);
    setSuccess(null);
    if (!composeTo.trim()) {
      setError('Escribe el destinatario.');
      return;
    }
    if (!composeSubject.trim()) {
      setError('Escribe el asunto.');
      return;
    }
    if (!composeBody.trim()) {
      setError('Escribe el mensaje.');
      return;
    }
    setSending(true);
    try {
      const t = await getToken();
      if (!t) return;
      const res = await fetch('/api/admin/mail/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
        body: JSON.stringify({
          fromAccount: account,
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Error al enviar');
      setSuccess('Correo enviado.');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      loadInbox();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          window.location.href = '/login?returnTo=/admin/correo';
          return;
        }
        await loadConfig();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isBooting && mailboxes.length > 0) void loadInbox();
  }, [isBooting, account, page, mailboxes.length]);

  if (isBooting) {
    return (
      <div className="rounded-3xl bg-white/80 p-8 shadow-sm ring-1 ring-black/5">
        <div className="text-sm text-gray-600">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-gray-900">Buzón de correo</div>
          <div className="mt-1 text-sm text-gray-600">
            Lee y envía correos desde las cuentas configuradas en Configuración → Buzón de correo.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 rounded-xl border border-gray-300 px-4 py-2 pl-10 text-sm outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Configuración
          </Link>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Redactar
          </button>
          <button
            type="button"
            onClick={() => void loadInbox()}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
          >
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-4">
        <h3 className="text-sm font-bold text-blue-900">Notificaciones automáticas por correo</h3>
        <p className="mt-2 text-sm text-blue-800">
          Las notificaciones transaccionales se envían <strong>de forma automática</strong> a los correos de usuarios
          cuando ocurre algo en la plataforma: pago acreditado (Mercado Pago u offline), envío registrado, recepción
          confirmada, disputa abierta o resuelta, pago de guía Estafeta, etc.
        </p>
        <p className="mt-2 text-sm text-blue-800">
          Se usan las cuentas configuradas en <Link href="/admin/settings" className="font-semibold text-blue-700 underline">Configuración → Buzón</Link>.
          Por defecto se envía desde la <strong>primera cuenta</strong>. Usa dominios verificados (SPF/DKIM) para que los correos no lleguen a SPAM.
        </p>
        <p className="mt-2 text-xs text-blue-700">
          Variables de entorno opcionales: <code className="rounded bg-blue-100 px-1">EMAIL_NOTIFICATIONS_ENABLED</code> (default: true),{' '}
          <code className="rounded bg-blue-100 px-1">EMAIL_NOTIFICATIONS_MAILBOX_INDEX</code> (0, 1, 2 o 3).
        </p>
      </div>

      {mailboxes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          No hay cuentas de correo configuradas. Ve a <Link href="/admin/settings" className="font-semibold text-brand-emerald underline">Configuración</Link> → Buzón de correo y añade hasta 4 cuentas con dominio propio (IMAP + SMTP).
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Cuenta:</label>
            <select
              value={account}
              onChange={(e) => { setAccount(Number(e.target.value)); setPage(1); setSelected(null); setFullEmail(null); }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {mailboxes.map((m) => (
                <option key={m.index} value={m.index}>
                  {m.label || m.email} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">
                Recibidos {total > 0 ? `(${total})` : ''}
              </div>
              {loading ? (
                <div className="p-6 text-center text-sm text-gray-500">Cargando…</div>
              ) : filteredEmails.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  {searchTerm ? 'No hay resultados para la búsqueda.' : 'No hay correos o no se pudo conectar al buzón.'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredEmails.map((e) => (
                    <li
                      key={e.uid}
                      onClick={() => void loadEmail(e.uid)}
                      className={`cursor-pointer px-4 py-3 transition hover:bg-gray-50 ${selected?.uid === e.uid ? 'bg-pink-50' : ''}`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="flex items-center gap-1 truncate text-sm font-medium text-gray-900">
                          {e.from || '—'}
                          <button
                            onClick={(ev) => {
                              ev.preventDefault();
                              ev.stopPropagation();
                              const emailMatch = (e.from || '').match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                              const email = emailMatch ? emailMatch[1] : e.from;
                              copyToClipboard(email || '', String(e.uid));
                            }}
                            className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                            title="Copiar correo"
                          >
                            {copiedId === String(e.uid) ? '✅' : '📋'}
                          </button>
                        </div>
                        <span className="shrink-0 text-xs text-gray-500">{fmtDate(e.date)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-sm text-gray-600">{e.subject || '(sin asunto)'}</div>
                    </li>
                  ))}
                </ul>
              )}
              {total > 25 && (
                <div className="flex justify-center gap-2 border-t border-gray-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg bg-gray-100 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="py-1 text-sm text-gray-600">Pág. {page}</span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={emails.length < 25}
                    className="rounded-lg bg-gray-100 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">
                {selected ? 'Mensaje' : 'Selecciona un correo'}
              </div>
              <div className="max-h-[480px] overflow-y-auto p-4">
                {loadingEmail ? (
                  <div className="text-center text-sm text-gray-500">Cargando…</div>
                ) : fullEmail ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div><span className="font-medium text-gray-600">De:</span> {fullEmail.from}</div>
                        <div><span className="font-medium text-gray-600">Para:</span> {fullEmail.to}</div>
                        <div><span className="font-medium text-gray-600">Asunto:</span> {fullEmail.subject}</div>
                        {fullEmail.date ? <div className="text-gray-500">{fmtDate(fullEmail.date)}</div> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Extraer el email del remitente
                          const fromMatch = fullEmail.from.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
                          const replyTo = fromMatch ? fromMatch[1] : fullEmail.from;
                          setComposeTo(replyTo);
                          setComposeSubject(fullEmail.subject.startsWith('Re:') ? fullEmail.subject : `Re: ${fullEmail.subject}`);
                          setComposeBody(`\n\n--- Mensaje original ---\nDe: ${fullEmail.from}\nFecha: ${fullEmail.date ? fmtDate(fullEmail.date) : '—'}\nAsunto: ${fullEmail.subject}\n\n${fullEmail.text || fullEmail.html?.replace(/<[^>]*>/g, '') || ''}`);
                          setComposeOpen(true);
                        }}
                        className="shrink-0 rounded-lg bg-brand-emerald px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Responder
                      </button>
                    </div>
                    <hr className="border-gray-200" />
                    {fullEmail.html ? (
                      <div dangerouslySetInnerHTML={{ __html: fullEmail.html }} className="prose prose-sm max-w-none" />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-gray-700">{fullEmail.text || '—'}</pre>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500">Haz clic en un correo para verlo.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {composeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !sending && setComposeOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">Redactar</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600">Para *</label>
                <input
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="destinatario@ejemplo.com"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Asunto *</label>
                <input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Asunto"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Mensaje *</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={6}
                  placeholder="Escribe tu mensaje…"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !sending && setComposeOpen(false)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void sendEmail()}
                disabled={sending}
                className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
