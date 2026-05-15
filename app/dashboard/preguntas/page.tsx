'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { redirectToLogin } from '@/lib/auth/redirect';
import { EmojiPicker } from '@/components/EmojiPicker';
import { PageTour } from '@/components/PageTour';
import { pageTours } from '@/lib/tours/config';
import { useImpersonation } from '@/components/ImpersonationProvider';

type QRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  asker_id: string;
  question_text: string;
  answer_text: string | null;
  created_at: string;
  answered_at: string | null;
};

type ListingMeta = {
  title: string;
  public_id?: string | null;
  image?: string | null;
};

function formatDate(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function DashboardPreguntasPage() {
  const { isImpersonating, targetUserId } = useImpersonation();
  const [isBooting, setIsBooting] = useState(true);
  const [savingQuestionIds, setSavingQuestionIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'preguntas' | 'respuestas'>('preguntas');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<QRow[]>([]);
  const [listingMetaById, setListingMetaById] = useState<Record<string, ListingMeta>>({});
  const [askerNames, setAskerNames] = useState<Record<string, string>>({});
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set()); // Preguntas ya respondidas
  const [questionsAsBuyer, setQuestionsAsBuyer] = useState<Set<string>>(new Set()); // IDs de preguntas que el usuario hizo como comprador

  // Persistir preguntas respondidas en localStorage para que no reaparezcan al recargar
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('pocket_answered_questions_v1');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setAnsweredQuestionIds(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn('[PREGUNTAS] Error al cargar preguntas respondidas de localStorage:', e);
    }
  }, []);

  // Guardar preguntas respondidas en localStorage cuando cambien
  useEffect(() => {
    try {
      const array = Array.from(answeredQuestionIds);
      window.localStorage.setItem('pocket_answered_questions_v1', JSON.stringify(array));
    } catch (e) {
      console.warn('[PREGUNTAS] Error al guardar preguntas respondidas en localStorage:', e);
    }
  }, [answeredQuestionIds]);

  // Monitorear cambios en rows para diagnóstico
  useEffect(() => {
    console.log('[PREGUNTAS PAGE] 🔄 rows cambió:', {
      count: rows.length,
      ids: rows.map(r => r.id),
      detalles: rows.map(r => ({
        id: r.id,
        listing_id: r.listing_id,
        answer_text: r.answer_text,
        hasAnswer: !!(r.answer_text && String(r.answer_text).trim() !== ''),
      })),
    });
  }, [rows]);

  // Filtrar preguntas:
  // - Si el usuario es VENDEDOR: solo mostrar las que NO tienen respuesta (pendientes de responder)
  // - Si el usuario es COMPRADOR: mostrar TODAS (con y sin respuesta)
  const unanswered = useMemo(() => {
    const filtered = rows.filter((r) => {
      const isQuestionAsBuyer = questionsAsBuyer.has(r.id);

      // Si es pregunta que el usuario hizo como comprador, mostrar siempre (con o sin respuesta)
      if (isQuestionAsBuyer) {
        console.log('[PREGUNTAS PAGE] ✅ Mostrando pregunta como comprador:', {
          id: r.id,
          hasAnswer: !!(r.answer_text && String(r.answer_text).trim() !== ''),
          questionPreview: r.question_text?.substring(0, 30),
        });
        return true;
      }

      // Si es pregunta donde el usuario es vendedor, solo mostrar si NO tiene respuesta
      const answer = r?.answer_text;
      const isNull = answer === null;
      const isUndefined = answer === undefined;
      const isEmptyString = answer === '';
      const isWhitespaceOnly = typeof answer === 'string' && answer.trim() === '';
      const hasAnswerText = !isNull && !isUndefined && !isEmptyString && !isWhitespaceOnly;

      // Solo mostrar si NO tiene respuesta
      const shouldShow = !hasAnswerText;
      if (!shouldShow) {
        console.log('[PREGUNTAS PAGE] ❌ Ocultando pregunta como vendedor (ya respondida):', {
          id: r.id,
          hasAnswerText,
        });
      }
      return shouldShow;
    });

    console.log('[PREGUNTAS PAGE] Filtrado final:', {
      totalRows: rows.length,
      filteredCount: filtered.length,
      comoComprador: rows.filter(r => questionsAsBuyer.has(r.id)).length,
      comoVendedor: rows.filter(r => !questionsAsBuyer.has(r.id)).length,
      comoCompradorFiltradas: filtered.filter(r => questionsAsBuyer.has(r.id)).length,
      comoVendedorFiltradas: filtered.filter(r => !questionsAsBuyer.has(r.id)).length,
      questionsAsBuyerSize: questionsAsBuyer.size,
      questionsAsBuyerIds: Array.from(questionsAsBuyer),
    });

    return filtered;
  }, [rows, answeredQuestionIds, questionsAsBuyer]);

  // Separar preguntas como vendedor y como comprador
  const sellerQuestions = useMemo(() => unanswered.filter(q => !questionsAsBuyer.has(q.id)), [unanswered, questionsAsBuyer]);
  const buyerQuestions = useMemo(() => unanswered.filter(q => questionsAsBuyer.has(q.id)), [unanswered, questionsAsBuyer]);

  // Helper para agrupar preguntas por publicación y usuario
  function groupByListing(list: QRow[]) {
    const byListing: Record<string, QRow[]> = {};
    list.forEach((q) => {
      const listingId = q.listing_id || 'sin-publicacion';
      if (!byListing[listingId]) byListing[listingId] = [];
      byListing[listingId].push(q);
    });

    const result: Array<{
      listingId: string;
      listingTitle: string;
      listingImage: string | null;
      listingPublicId: string | null;
      userGroups: Array<{
        askerId: string;
        askerName: string;
        questions: QRow[];
      }>;
    }> = [];

    Object.entries(byListing).forEach(([listingId, questions]) => {
      const byUser: Record<string, QRow[]> = {};
      questions.forEach((q) => {
        const askerId = q.asker_id || 'sin-usuario';
        if (!byUser[askerId]) byUser[askerId] = [];
        byUser[askerId].push(q);
      });

      const sortedUsers = Object.entries(byUser).sort((a, b) => {
        const latestA = Math.max(...a[1].map(q => new Date(q.created_at || 0).getTime()));
        const latestB = Math.max(...b[1].map(q => new Date(q.created_at || 0).getTime()));
        return latestB - latestA;
      });

      result.push({
        listingId,
        listingTitle: listingMetaById[listingId]?.title || 'Publicación',
        listingImage: listingMetaById[listingId]?.image || null,
        listingPublicId: listingMetaById[listingId]?.public_id || null,
        userGroups: sortedUsers.map(([askerId, userQuestions]) => ({
          askerId,
          askerName: askerNames[askerId] || `${askerId.slice(0, 6)}…`,
          questions: userQuestions.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          }),
        })),
      });
    });

    result.sort((a, b) => {
      const latestA = Math.max(...a.userGroups.flatMap(ug => ug.questions.map(q => new Date(q.created_at || 0).getTime())));
      const latestB = Math.max(...b.userGroups.flatMap(ug => ug.questions.map(q => new Date(q.created_at || 0).getTime())));
      return latestB - latestA;
    });

    return result;
  }

  // Agrupar por tab
  const groupedSellerQuestions = useMemo(() => groupByListing(sellerQuestions), [sellerQuestions, listingMetaById, askerNames]);
  const groupedBuyerQuestions = useMemo(() => groupByListing(buyerQuestions), [buyerQuestions, listingMetaById, askerNames]);
  const groupedQuestions = activeTab === 'preguntas' ? groupedSellerQuestions : groupedBuyerQuestions;

  const load = async (uid: string) => {
    setError(null);
    setSuccess(null);

    // Intentar cargar preguntas usando API (más confiable que RLS directo)
    try {
      // Intentar obtener sesión, si falla intentar refrescar
      let sess = await supabase.auth.getSession();
      let token = sess.data?.session?.access_token;

      if (!token) {
        // Si no hay sesión, intentar refrescar
        const refreshResult = await supabase.auth.refreshSession();
        if (refreshResult.data?.session) {
          token = refreshResult.data.session.access_token;
        }
      }

      // Si aún no hay token, intentar obtenerlo del usuario directamente
      if (!token) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          // Intentar obtener el token de otra forma
          const currentSession = await supabase.auth.getSession();
          token = currentSession.data?.session?.access_token;
        }
      }

      if (token) {
        // 1. Cargar preguntas donde el usuario es VENDEDOR (preguntas que le hacen)
        const apiRes = await fetch(`/api/questions/list-v2?sellerId=${encodeURIComponent(uid)}&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const apiJson = await apiRes.json().catch(() => ({}));
        console.log('[PREGUNTAS PAGE] Respuesta API (como vendedor):', {
          ok: apiRes.ok,
          status: apiRes.status,
          hasQuestions: Array.isArray(apiJson?.questions),
          count: Array.isArray(apiJson?.questions) ? apiJson.questions.length : 0,
          error: apiJson?.error,
        });

        // 2. Cargar preguntas donde el usuario es COMPRADOR (preguntas que él hizo)
        const askerRes = await fetch(`/api/responses/list?t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
          cache: 'no-store',
        });
        const askerJson = await askerRes.json().catch(() => ({}));
        console.log('[PREGUNTAS PAGE] Respuesta API (como comprador):', {
          ok: askerRes.ok,
          status: askerRes.status,
          hasResponses: Array.isArray(askerJson?.responses),
          count: Array.isArray(askerJson?.responses) ? askerJson.responses.length : 0,
          error: askerJson?.error,
        });

        if (!apiRes.ok) {
          console.error('[PREGUNTAS PAGE] Error en API (vendedor):', apiJson);
          setError(`Error al cargar preguntas: ${apiJson?.error || 'Error desconocido'}`);
        }

        // Combinar preguntas como vendedor y como comprador
        const questionsAsSeller: QRow[] = apiRes.ok && Array.isArray(apiJson?.questions)
          ? (apiJson.questions as any[]) as QRow[]
          : [];

        // Convertir respuestas a formato QRow (preguntas que el usuario hizo)
        const questionsAsBuyerList: QRow[] = askerRes.ok && Array.isArray(askerJson?.responses)
          ? askerJson.responses.map((r: any) => ({
            id: r.question_id,
            listing_id: r.listing_id,
            seller_id: r.seller_id,
            asker_id: r.asker_id,
            question_text: r.question_text,
            answer_text: r.answer_text,
            created_at: r.created_at,
            answered_at: r.answered_at,
          })) as QRow[]
          : [];

        // Guardar IDs de preguntas que el usuario hizo como comprador ANTES de combinar
        const buyerQuestionIds = new Set(questionsAsBuyerList.map(q => q.id));

        // Combinar ambas listas, evitando duplicados
        const allQuestionsMap = new Map<string, QRow>();
        questionsAsSeller.forEach(q => allQuestionsMap.set(q.id, q));
        questionsAsBuyerList.forEach(q => allQuestionsMap.set(q.id, q));
        const qs = Array.from(allQuestionsMap.values());

        console.log('[PREGUNTAS PAGE] Preguntas combinadas:', {
          comoVendedor: questionsAsSeller.length,
          comoComprador: questionsAsBuyerList.length,
          total: qs.length,
          buyerIds: Array.from(buyerQuestionIds),
        });

        // Establecer questionsAsBuyer ANTES de setRows para que el filtro funcione correctamente
        setQuestionsAsBuyer(buyerQuestionIds);

        if (qs.length > 0) {
          console.log('[PREGUNTAS PAGE] Preguntas recibidas del API:', {
            total: qs.length,
            debugInfo: apiJson?.debug,
            detalles: qs.map(q => ({
              id: q.id,
              seller_id: q.seller_id,
              listing_id: q.listing_id,
              answer_text: q.answer_text ? String(q.answer_text).substring(0, 30) : null,
              hasAnswer: !!(q.answer_text && String(q.answer_text).trim() !== ''),
            })),
          });

          // Si el API devuelve 0 preguntas pero el debug muestra más, alertar
          if (qs.length === 0 && apiJson?.debug?.unanswered > 0) {
            console.warn('[PREGUNTAS PAGE] ⚠️ DISCREPANCIA: API devuelve 0 preguntas pero debug muestra', apiJson.debug.unanswered);
          }

          // CRÍTICO: El API es la fuente de verdad. Si el API devuelve una pregunta, significa que NO está respondida en la BD.
          // Por lo tanto, debemos SINCRONIZAR localStorage ANTES de filtrar, removiendo cualquier pregunta que el API devolvió.
          const idsFromAPI = new Set(qs.map(q => q.id));
          const toRemoveFromLocalStorage: string[] = [];

          // Identificar preguntas que están en localStorage pero el API las devolvió (discrepancia)
          answeredQuestionIds.forEach((id) => {
            if (idsFromAPI.has(id)) {
              console.warn('[PREGUNTAS PAGE] ⚠️ Pregunta en localStorage pero API la devolvió (no está respondida en BD). Sincronizando:', id);
              toRemoveFromLocalStorage.push(id);
            }
          });

          // Remover del localStorage de forma síncrona (actualizar estado antes de filtrar)
          if (toRemoveFromLocalStorage.length > 0) {
            setAnsweredQuestionIds((prev) => {
              const next = new Set(prev);
              toRemoveFromLocalStorage.forEach(id => next.delete(id));
              console.log('[PREGUNTAS PAGE] ✅ localStorage sincronizado. Removidas:', toRemoveFromLocalStorage.length, 'IDs:', toRemoveFromLocalStorage);
              return next;
            });
          }

          // NO filtrar aquí - el filtro unanswered se encargará de mostrar:
          // - Todas las preguntas del usuario como comprador (con y sin respuesta)
          // - Solo las preguntas sin respuesta del usuario como vendedor
          // Excluimos SOLO las que están guardando actualmente
          const finalQs = qs.filter(q => {
            // Excluir las que estamos guardando actualmente
            if (savingQuestionIds.has(q.id)) {
              console.log('[PREGUNTAS PAGE] Pregunta excluida (guardando):', q.id);
              return false;
            }

            // NO excluir preguntas con respuesta aquí - el filtro unanswered lo manejará
            // Si es pregunta del usuario como comprador, se mostrará aunque tenga respuesta
            // Si es pregunta del usuario como vendedor, el filtro unanswered la excluirá si tiene respuesta

            return true;
          });

          /*
          console.log('[PREGUNTAS PAGE] Preguntas finales para mostrar:', {
            totalRecibidasDelAPI: qs.length,
            finalesParaMostrar: finalQs.length,
            excluidasPorGuardando: qs.filter(q => savingQuestionIds.has(q.id)).length,
            excluidasPorLocalStorage: qs.filter(q => answeredQuestionIds.has(q.id)).length,
            excluidasPorTenerRespuesta: qs.filter(q => q.answer_text && String(q.answer_text).trim() !== '').length,
            idsEnLocalStorage: Array.from(answeredQuestionIds),
            idsDePreguntasFinales: finalQs.map(q => q.id),
            detallesFinales: finalQs.map(q => ({
              id: q.id,
              listing_id: q.listing_id,
              answer_text: q.answer_text,
              hasAnswer: !!(q.answer_text && String(q.answer_text).trim() !== ''),
            })),
          });
          */

          // Si no hay preguntas pero el debug muestra que debería haber, alertar
          if (finalQs.length === 0 && qs.length === 0) {
            // console.warn('[PREGUNTAS PAGE] ⚠️ El API no devolvió ninguna pregunta. Verifica el endpoint /api/questions/list');
          } else if (finalQs.length === 0 && qs.length > 0) {
            // console.warn('[PREGUNTAS PAGE] ⚠️ El API devolvió', qs.length, 'preguntas pero todas fueron filtradas por localStorage o guardando');
          }

          // console.log('[PREGUNTAS PAGE] ⚠️ ANTES DE setRows - rows actual:', rows.length);
          setRows(qs); // Guardar TODAS las preguntas (con y sin respuesta)
          // console.log('[PREGUNTAS PAGE] ✅ DESPUÉS DE setRows - se establecieron:', qs.length, 'preguntas');

          const listingIds = Array.from(new Set(qs.map((q) => q.listing_id).filter(Boolean)));
          if (listingIds.length > 0) {
            const lres: any = await supabase.from('listings').select('id,title,public_id,images').in('id', listingIds);
            if (!lres.error && Array.isArray(lres.data)) {
              const map: Record<string, ListingMeta> = {};
              for (const l of lres.data as any[]) {
                const id = String(l?.id || '').trim();
                if (!id) continue;
                const t = String(l?.title || 'Publicación').trim() || 'Publicación';
                const pid = String(l?.public_id || '').trim();
                const imgs = Array.isArray(l?.images) ? (l.images as any[]).filter(Boolean) : [];
                const img = imgs[0] ? String(imgs[0]) : null;
                map[id] = { title: t, public_id: pid || null, image: img };
              }
              setListingMetaById(map);
            }
          }

          // Resolver nombres de quien pregunta
          const askerIds = Array.from(new Set(qs.map((q) => q.asker_id).filter(Boolean)));
          console.log('[PREGUNTAS PAGE] Cargando nombres de askers:', { count: askerIds.length, ids: askerIds });
          if (askerIds.length > 0) {
            try {
              // Usar solo id y full_name (las columnas nickname y username no existen en esta base de datos)
              const pres: any = await supabase.from('profiles').select('id,full_name').in('id', askerIds);

              if (!pres.error && Array.isArray(pres.data)) {
                const map: Record<string, string> = {};
                for (const p of pres.data as any[]) {
                  const id = String(p?.id || '').trim();
                  if (!id) continue;
                  const name = String(p?.full_name || '').trim() || `${id.slice(0, 6)}…`;
                  map[id] = name;
                }
                console.log('[PREGUNTAS PAGE] Nombres cargados:', { count: Object.keys(map).length });
                setAskerNames(map);
              } else if (pres.error) {
                console.warn('[PREGUNTAS PAGE] No se pudieron cargar nombres, continuando sin ellos:', pres.error);
              }
            } catch (err) {
              console.warn('[PREGUNTAS PAGE] Excepción al cargar nombres (no crítico):', err);
              // Continuar sin nombres, no es crítico para mostrar las preguntas
            }
          }
          return; // Salir exitosamente
        }
      }
    } catch (apiErr) {
      console.warn('Error al cargar preguntas vía API, intentando método directo:', apiErr);
    }

    // Fallback: intentar cargar preguntas con el cliente normal (RLS)
    let res: any = await supabase
      .from('listing_questions')
      .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
      .eq('seller_id', uid)
      .eq('is_deleted', false)
      .is('answer_text', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (res?.error) {
      const code = String(res.error?.code || '');
      const msg = String(res.error?.message || '');
      const low = msg.toLowerCase();
      if (code === '42P01' || low.includes('does not exist') || low.includes('schema cache') || code === 'PGRST106') {
        setRows([]);
        setError('Tu BD aún no tiene `listing_questions`. Ejecuta `supabase_listing_questions.sql` en Supabase y recarga.');
        return;
      }

      // Si hay error de RLS o permisos, mostrar error pero no fallar completamente
      console.error('Error al cargar preguntas directamente:', res.error);
      setError(`Error al cargar preguntas: ${res.error.message}. Si el problema persiste, ejecuta \`supabase_listing_questions_rls_fix.sql\` en Supabase.`);
      setRows([]);
      return;
    }

    const qs = ((res.data as any[]) ?? []) as QRow[];
    const filteredQs = qs.filter((q) => {
      const qSellerId = String(q.seller_id || '').trim();
      const matches = qSellerId === uid;
      if (!matches) {
        console.log('[PREGUNTAS PAGE] Pregunta filtrada (seller_id no coincide):', {
          id: q.id,
          qSellerId,
          uid,
        });
      }
      return matches;
    });

    // Filtrar solo las que no tienen respuesta
    const unansweredFiltered = filteredQs.filter(q => {
      const hasAnswer = q.answer_text && String(q.answer_text).trim() !== '';
      if (hasAnswer) {
        console.log('[PREGUNTAS PAGE] Pregunta filtrada (tiene respuesta en fallback):', {
          id: q.id,
          answer_text: String(q.answer_text).substring(0, 30),
        });
      }
      return !hasAnswer;
    });

    const finalQs = unansweredFiltered.filter(q => !savingQuestionIds.has(q.id));

    console.log('[PREGUNTAS PAGE] Fallback - Preguntas después de filtros:', {
      total: qs.length,
      filtradasPorSeller: filteredQs.length,
      sinRespuesta: unansweredFiltered.length,
      excluidasPorSaving: unansweredFiltered.filter(q => savingQuestionIds.has(q.id)).length,
      finales: finalQs.length,
    });
    setRows(finalQs);

    const listingIds = Array.from(new Set(filteredQs.map((q) => q.listing_id).filter(Boolean)));
    if (listingIds.length > 0) {
      const lres: any = await supabase.from('listings').select('id,title,public_id,images').in('id', listingIds);
      if (!lres.error && Array.isArray(lres.data)) {
        const map: Record<string, ListingMeta> = {};
        for (const l of lres.data as any[]) {
          const id = String(l?.id || '').trim();
          if (!id) continue;
          const t = String(l?.title || 'Publicación').trim() || 'Publicación';
          const pid = String(l?.public_id || '').trim();
          const imgs = Array.isArray(l?.images) ? (l.images as any[]).filter(Boolean) : [];
          const img = imgs[0] ? String(imgs[0]) : null;
          map[id] = { title: t, public_id: pid || null, image: img };
        }
        setListingMetaById(map);
      }
    }

    // Resolver nombres de quien pregunta
    const askerIds = Array.from(new Set(filteredQs.map((q) => q.asker_id).filter(Boolean)));
    if (askerIds.length > 0) {
      try {
        // Usar solo id y full_name (las columnas nickname y username no existen en esta base de datos)
        const pres: any = await supabase.from('profiles').select('id,full_name').in('id', askerIds);

        if (!pres.error && Array.isArray(pres.data)) {
          const map: Record<string, string> = {};
          for (const p of pres.data as any[]) {
            const id = String(p?.id || '').trim();
            if (!id) continue;
            const name = String(p?.full_name || '').trim() || `${id.slice(0, 6)}…`;
            map[id] = name;
          }
          setAskerNames(map);
        }
      } catch (err) {
        console.warn('[PREGUNTAS PAGE] Error al cargar nombres (fallback, no crítico):', err);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        setSuccess(null);

        // ── IMPERSONATION MODE ──
        if (isImpersonating && targetUserId) {
          if (cancelled) return;
          setUserId(targetUserId);
          await load(targetUserId);
          if (!cancelled) setIsBooting(false);
          return;
        }

        // ── NORMAL MODE ──
        const { data, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        if (!data.user) {
          redirectToLogin();
          return;
        }
        if (cancelled) return;
        setUserId(data.user.id);
        await load(data.user.id);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus preguntas.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating, targetUserId]);

  const answer = async (questionId: string) => {
    // Prevenir múltiples clics en el mismo botón
    if (savingQuestionIds.has(questionId)) {
      console.log('[ANSWER] Ya se está guardando esta pregunta, ignorando clic');
      return;
    }

    setError(null);
    setSuccess(null);

    // Marcar esta pregunta específica como guardando
    setSavingQuestionIds((prev) => new Set(prev).add(questionId));

    try {
      const text = String(draftAnswers[questionId] || '').trim();
      if (!text) {
        setError('Escribe una respuesta.');
        setSavingQuestionIds((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
        return;
      }

      // Intentar obtener sesión, si falla intentar refrescar
      let sess = await supabase.auth.getSession();
      let token = sess.data?.session?.access_token;

      if (!token) {
        // Si no hay sesión, intentar refrescar
        const refreshResult = await supabase.auth.refreshSession();
        if (refreshResult.data?.session) {
          token = refreshResult.data.session.access_token;
        }
      }

      // Si aún no hay token, intentar obtenerlo del usuario directamente
      if (!token) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const currentSession = await supabase.auth.getSession();
          token = currentSession.data?.session?.access_token;
        }
      }

      if (!token) {
        redirectToLogin();
        setSavingQuestionIds((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
        return;
      }

      console.log('[ANSWER] Enviando respuesta para pregunta:', {
        questionId,
        answerLength: text.length,
        answerPreview: text.substring(0, 50),
        userId,
      });

      // Usar el nuevo endpoint v2
      const res = await fetch('/api/questions/answer-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ questionId, answerText: text }),
      });

      const json = await res.json().catch((e) => {
        console.error('[ANSWER] Error al parsear respuesta JSON:', e);
        return { error: 'Error al procesar respuesta del servidor' };
      });

      console.log('[ANSWER] Respuesta del servidor:', {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        json,
        hasError: !!json?.error,
        verified: json?.verified,
      });

      if (!res.ok) {
        const errorMsg = json?.error || `Error ${res.status}: ${res.statusText}`;

        // Si el error es que la pregunta ya fue respondida, tratarla como éxito
        if (json?.alreadyAnswered || errorMsg.includes('ya fue respondida') || errorMsg.includes('already answered')) {
          console.log('[ANSWER] ⚠️ Pregunta ya respondida, removiendo de la lista...');

          // Agregar a localStorage para que no reaparezca
          setAnsweredQuestionIds((prev) => {
            const next = new Set(prev);
            next.add(questionId);
            return next;
          });

          // Remover de la lista
          setRows((prevRows) => prevRows.filter((q) => q.id !== questionId));

          // Limpiar el texto
          setDraftAnswers((p) => ({ ...p, [questionId]: '' }));

          // Mostrar mensaje informativo (no error)
          setSuccess('✅ Esta pregunta ya fue respondida anteriormente.');

          // NO recargar automáticamente - la pregunta ya fue removida
          console.log('[ANSWER] Pregunta ya respondida. Removida de la lista. No se recargará automáticamente.');

          return; // Salir sin error
        }

        // Si el error es "Question not found" o "Question has been deleted", remover de la lista
        if (errorMsg.includes('not found') || errorMsg.includes('deleted') || res.status === 404) {
          console.warn('[ANSWER] ⚠️ Pregunta no encontrada o eliminada, removiendo de la lista:', {
            questionId,
            error: errorMsg,
            status: res.status,
          });

          // Remover de la lista
          setRows((prevRows) => prevRows.filter((q) => q.id !== questionId));

          // Limpiar el texto
          setDraftAnswers((p) => ({ ...p, [questionId]: '' }));

          // Mostrar mensaje informativo
          setSuccess('⚠️ Esta pregunta ya no está disponible. Se ha removido de la lista.');

          return; // Salir sin error
        }

        console.error('[ANSWER] ❌ Error del servidor:', {
          status: res.status,
          statusText: res.statusText,
          error: errorMsg,
          fullJson: json,
        });
        throw new Error(errorMsg);
      }

      console.log('[ANSWER] ✅ Respuesta guardada exitosamente en el servidor:', json);
      console.log('[ANSWER] notified:', json.notified, '| notify_reason:', json.notify_reason ?? '(no enviado)', '| error_detail:', json.notify_error_detail ?? '-');

      // Verificar que el servidor confirmó que se guardó (endpoint v2 devuelve question.answer_text)
      const answerText = json.question?.answer_text ? String(json.question.answer_text).trim() : '';
      if (!json.ok || !json.verified || !answerText || answerText.length === 0) {
        console.error('[ANSWER] ❌ El servidor no confirmó que la respuesta se guardó:', {
          ok: json.ok,
          verified: json.verified,
          hasAnswer: !!json.question?.answer_text,
          answerLength: answerText.length,
          answerPreview: answerText.substring(0, 50),
          fullJson: json,
        });
        throw new Error('El servidor no confirmó que la respuesta se guardó correctamente. Intenta nuevamente.');
      }

      // Verificar que la respuesta verificada esté presente
      if (!json.verified) {
        console.warn('[ANSWER] ⚠️ El servidor no indicó que la respuesta fue verificada:', json);
      }

      // IMPORTANTE: Agregar a localStorage PRIMERO para que no reaparezca al recargar
      setAnsweredQuestionIds((prev) => {
        const next = new Set(prev);
        next.add(questionId);
        console.log('[ANSWER] Pregunta agregada a answeredQuestionIds:', questionId, 'Total:', next.size);
        return next;
      });

      // Remover la pregunta de la lista inmediatamente
      setRows((prevRows) => {
        const filtered = prevRows.filter((q) => q.id !== questionId);
        console.log('[ANSWER] Pregunta removida de rows. Antes:', prevRows.length, 'Después:', filtered.length);
        return filtered;
      });

      // Limpiar el texto de la respuesta
      setDraftAnswers((p) => ({ ...p, [questionId]: '' }));

      if (json.notified === true) {
        setSuccess('✅ Respuesta guardada. Se notificó al comprador.');
      } else if (json.notified === false) {
        const reason = json.notify_reason;
        const errDetail = typeof json.notify_error_detail === 'string' ? json.notify_error_detail.trim() : '';
        if (reason === 'asker_id_missing') {
          setSuccess('✅ Respuesta guardada. No se pudo notificar al comprador (pregunta sin asker_id).');
        } else if (reason === 'insert_failed') {
          const extra = errDetail ? ` Revisa consola (F12) para más detalle.` : '';
          setSuccess(`✅ Respuesta guardada. No se pudo notificar al comprador (error al crear notificación).${extra}`);
        } else {
          setSuccess('✅ Respuesta guardada. No se pudo notificar al comprador.');
        }
      } else {
        setSuccess('✅ Respuesta guardada correctamente.');
      }

      // NO recargar automáticamente - la pregunta ya fue removida de la lista
      // Solo recargar si el usuario lo solicita manualmente
      // Esto evita que las preguntas reaparezcan si hay problemas de timing en la BD
      console.log('[ANSWER] Respuesta guardada. La pregunta fue removida de la lista. No se recargará automáticamente.');

      console.log('[ANSWER] Respuesta guardada y preguntas actualizadas.');
    } catch (e: unknown) {
      console.error('[ANSWER] Error completo:', e);
      const errorMessage = e instanceof Error ? e.message : 'No se pudo responder.';
      console.error('[ANSWER] Mensaje de error:', errorMessage);
      setError(`❌ ${errorMessage}. Si el problema persiste, verifica la consola del navegador para más detalles.`);

      // Si hay error, NO recargar automáticamente para evitar que reaparezcan preguntas
      // El usuario puede hacer clic en "Actualizar" manualmente si necesita
      console.log('[ANSWER] Error al responder. La pregunta NO se removió de la lista.');
    } finally {
      // Siempre remover el ID del set de guardando
      setSavingQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Preguntas</div>
              <div className="text-xs text-gray-500">Responde dudas de tus publicaciones</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {false && (
              <button
                type="button"
                onClick={async () => {
                  if (!userId) return;
                  try {
                    // Intentar obtener sesión, si falla intentar refrescar
                    let sess = await supabase.auth.getSession();
                    let token = sess.data?.session?.access_token;

                    if (!token) {
                      // Si no hay sesión, intentar refrescar
                      const refreshResult = await supabase.auth.refreshSession();
                      if (refreshResult.data?.session) {
                        token = refreshResult.data.session.access_token;
                      }
                    }

                    // Si aún no hay token, intentar obtenerlo del usuario directamente
                    if (!token) {
                      const { data: userData } = await supabase.auth.getUser();
                      if (userData?.user) {
                        const currentSession = await supabase.auth.getSession();
                        token = currentSession.data?.session?.access_token;
                      }
                    }

                    if (!token) {
                      alert('No se pudo obtener el token de autenticación. Por favor, recarga la página.');
                      return;
                    }

                    // Obtener debug
                    const res = await fetch(`/api/questions/debug?sellerId=${encodeURIComponent(userId)}`, {
                      headers: { authorization: `Bearer ${token}` },
                    });
                    const json = await res.json();
                    console.log('🔍 DEBUG INFO COMPLETO:', json);

                    // Obtener preguntas del API list
                    const listRes = await fetch(`/api/questions/list-v2?sellerId=${encodeURIComponent(userId)}&t=${Date.now()}`, {
                      headers: { authorization: `Bearer ${token}` },
                      cache: 'no-store',
                    });
                    const listJson = await listRes.json().catch(() => ({}));
                    console.log('📋 LIST API RESPONSE:', listJson);

                    const debug = json?.debug || {};
                    const localStorageCount = answeredQuestionIds.size;
                    const message = `🔍 DIAGNÓSTICO DE PREGUNTAS

📌 TU USER ID: ${userId}
(Copia este ID para usar en los scripts SQL)

Por seller_id: ${debug.bySellerId?.sinRespuesta || 0} sin respuesta (${debug.bySellerId?.total || 0} total)
Por listing_id: ${debug.byListingId?.sinRespuesta || 0} sin respuesta (${debug.byListingId?.total || 0} total)
Después de merge: ${debug.merged?.sinRespuesta || 0} sin respuesta (${debug.merged?.total || 0} total)
Preguntas finales (debug): ${debug.unansweredQuestions?.count || 0}
Preguntas devueltas por API /list: ${Array.isArray(listJson?.questions) ? listJson.questions.length : 0}
Preguntas en localStorage (excluidas): ${localStorageCount}

${debug.sellerIdProblems?.count > 0 ? `⚠️ ${debug.sellerIdProblems.count} preguntas con seller_id incorrecto` : '✅ Todos los seller_id correctos'}

Ver detalles completos en la consola (F12)`;

                    alert(message);
                  } catch (err) {
                    console.error('Error en debug:', err);
                    alert('Error al obtener información de debug. Ver consola para más detalles.');
                  }
                }}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 hover:bg-blue-600"
              >
                🔍 Debug
              </button>
            )}
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageTour steps={pageTours.preguntas || []} pageId="preguntas" />
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

        {/* Banner / hero */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-100 via-emerald-100 to-emerald-200 text-gray-900 shadow-sm ring-1 ring-emerald-200">
          <div className="relative p-6 sm:p-8">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-emerald/15 blur-3xl" aria-hidden="true" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-brand-emerald/15 blur-3xl" aria-hidden="true" />

            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="rounded-3xl bg-white/70 p-5 ring-1 ring-black/5 backdrop-blur sm:p-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                  Panel de vendedor
                </div>
                <div className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Responde rápido y vende más</div>
                <div className="mt-2 text-sm text-gray-700">
                  Un buen tiempo de respuesta mejora tu reputación y la conversión.
                </div>
              </div>

              <div className="grid gap-3 rounded-3xl bg-white/70 p-5 ring-1 ring-black/5 backdrop-blur sm:p-6">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                  <div className="text-[11px] font-semibold text-gray-600">Pendientes</div>
                  <div className="mt-1 text-3xl font-extrabold text-brand-emerald">
                    {unanswered.filter(q => !questionsAsBuyer.has(q.id)).length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (userId ? load(userId) : null)}
                  className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-black disabled:opacity-60"
                  disabled={isBooting || savingQuestionIds.size > 0}
                >
                  Actualizar
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
              <div className="rounded-2xl bg-white/70 px-4 py-3 text-gray-800 ring-1 ring-black/5 backdrop-blur">
                <span className="font-extrabold text-brand-emerald">Tip:</span> responde con medidas, estado y envío.
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-3 text-gray-800 ring-1 ring-black/5 backdrop-blur">
                <span className="font-extrabold text-brand-emerald">Tip:</span> ofrece alternativas (“tengo en otro color”).
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-3 text-gray-800 ring-1 ring-black/5 backdrop-blur">
                <span className="font-extrabold text-brand-emerald">Tip:</span> evita mensajes largos, ve al punto.
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabs ─── */}
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('preguntas')}
            className={`rounded-2xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${activeTab === 'preguntas'
              ? 'bg-brand-emerald text-white shadow-md ring-2 ring-brand-emerald/30'
              : 'bg-white text-gray-700 ring-1 ring-black/10 hover:bg-gray-50'
              }`}
          >
            Preguntas
            {sellerQuestions.length > 0 && (
              <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold ${activeTab === 'preguntas' ? 'bg-white/20 text-white' : 'bg-brand-emerald/10 text-brand-emerald'
                }`}>
                {sellerQuestions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('respuestas')}
            className={`rounded-2xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${activeTab === 'respuestas'
              ? 'bg-brand-emerald text-white shadow-md ring-2 ring-brand-emerald/30'
              : 'bg-white text-gray-700 ring-1 ring-black/10 hover:bg-gray-50'
              }`}
          >
            Respuestas
            {buyerQuestions.length > 0 && (
              <span className={`ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold ${activeTab === 'respuestas' ? 'bg-white/20 text-white' : 'bg-brand-emerald/10 text-brand-emerald'
                }`}>
                {buyerQuestions.length}
              </span>
            )}
          </button>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">
                {activeTab === 'preguntas' ? 'Preguntas recibidas' : 'Tus preguntas como comprador'}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {activeTab === 'preguntas' ? (
                  <>Preguntas que compradores hacen en tus publicaciones. <span className="font-extrabold text-brand-emerald">{sellerQuestions.length}</span> pendientes.</>
                ) : (
                  <>Preguntas que hiciste en publicaciones de otros vendedores. <span className="font-extrabold text-brand-emerald">{buyerQuestions.length}</span> preguntas.</>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'preguntas' && (
                <span className="hidden sm:inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                  Responde en <span className="ml-1 font-extrabold">menos de 1 hora</span>, si puedes.
                </span>
              )}
              <button
                type="button"
                onClick={() => (userId ? load(userId) : null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                disabled={isBooting || savingQuestionIds.size > 0}
              >
                Actualizar
              </button>
            </div>
          </div>

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : groupedQuestions.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">
              {activeTab === 'preguntas'
                ? 'No tienes preguntas pendientes por responder.'
                : 'No has hecho preguntas en publicaciones de otros vendedores.'}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {groupedQuestions.map((listingGroup) => {
                const { listingId, listingTitle, listingImage, listingPublicId, userGroups } = listingGroup;
                const totalQuestions = userGroups.reduce((sum, ug) => sum + ug.questions.length, 0);
                const answeredCount = userGroups.reduce((sum, ug) =>
                  sum + ug.questions.filter(q => {
                    const hasAnswer = q.answer_text && String(q.answer_text).trim() !== '';
                    return hasAnswer && questionsAsBuyer.has(q.id);
                  }).length, 0
                );
                const pendingCount = totalQuestions - answeredCount;

                return (
                  <div key={listingId} className="rounded-3xl border-2 border-brand-emerald/20 bg-white shadow-sm ring-1 ring-black/5">
                    {/* Encabezado del grupo: Información de la publicación */}
                    <div className="border-b border-gray-100 bg-gradient-to-r from-brand-emerald/5 to-purple-50/30 px-6 py-4">
                      <div className="flex items-center gap-4">
                        {/* Imagen del producto */}
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                          {listingImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={listingImage} alt={listingTitle} className="h-full w-full object-cover" draggable={false} />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-400">
                              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Información de la publicación */}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/listings/${listingId}`}
                            className="text-lg font-extrabold uppercase text-gray-900 hover:text-brand-emerald hover:underline"
                          >
                            {listingTitle}
                          </Link>
                          {listingPublicId && (
                            <div className="mt-1">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                ID: {listingPublicId}
                              </span>
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            {answeredCount > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
                                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                                {answeredCount} {answeredCount === 1 ? 'pregunta respondida' : 'preguntas respondidas'}
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-emerald/10 px-3 py-1 text-xs font-semibold text-brand-emerald">
                                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500" />
                                {pendingCount} {pendingCount === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lista de preguntas de esta publicación - Agrupadas por usuario */}
                    <div className="divide-y divide-gray-100">
                      {userGroups.map((userGroup) => {
                        const { askerId, askerName, questions: sortedQuestions } = userGroup;
                        const isCurrentUserAsBuyer = questionsAsBuyer.has(sortedQuestions[0]?.id || '');

                        return (
                          <div key={askerId} className="bg-white">
                            {/* Encabezado del usuario (solo si hay más de una pregunta o si no es el usuario actual como comprador) */}
                            {sortedQuestions.length > 1 && !isCurrentUserAsBuyer && (
                              <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-2">
                                <div className="text-xs font-semibold text-gray-600">
                                  Preguntas de{' '}
                                  <Link href={`/perfil/${askerId}`} className="text-brand-emerald hover:opacity-90 hover:underline">
                                    {askerName}
                                  </Link>
                                  {' '}({sortedQuestions.length})
                                </div>
                              </div>
                            )}

                            {/* Lista de preguntas de este usuario */}
                            {sortedQuestions.map((q, qIdx) => {
                              const isQuestionAsBuyer = questionsAsBuyer.has(q.id);
                              const hasAnswer = q.answer_text && String(q.answer_text).trim() !== '';
                              const isPending = !hasAnswer && !isQuestionAsBuyer; // Solo pendiente si es pregunta como vendedor sin respuesta
                              const isLastQuestion = qIdx === sortedQuestions.length - 1;

                              return (
                                <div key={q.id} className="group relative bg-white transition hover:bg-gray-50/50">
                                  <div className="flex gap-4 p-5">
                                    {/* Indicador visual con línea vertical */}
                                    <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                                      {!isLastQuestion && <div className="h-full w-px bg-gray-200" />}
                                    </div>

                                    {/* Contenido de la pregunta */}
                                    <div className="min-w-0 flex-1 space-y-3">
                                      <div className="text-sm font-medium text-gray-900">
                                        <span className="text-xs text-gray-500">Pregunta:</span> &ldquo;{q.question_text}&rdquo;
                                      </div>

                                      {/* Mostrar respuesta si existe */}
                                      {hasAnswer && (
                                        <div className="rounded-xl bg-green-100 px-4 py-3 text-sm font-medium text-gray-900">
                                          <span className="font-semibold">Respuesta:</span> {q.answer_text}
                                        </div>
                                      )}

                                      <div className="text-xs text-gray-500">
                                        Pregunta: {formatDate(q.created_at)}
                                        {hasAnswer && q.answered_at && ` • Respuesta: ${formatDate(q.answered_at)}`}
                                      </div>

                                      {/* Mostrar formulario solo si es pregunta como vendedor y no tiene respuesta */}
                                      {!isQuestionAsBuyer && !hasAnswer && (
                                        <form
                                          className="mt-3"
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            answer(q.id);
                                          }}
                                        >
                                          <label htmlFor={`respuesta-${q.id}`} className="block text-sm font-semibold text-gray-900">
                                            Responder
                                          </label>
                                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                                            <div className="w-full flex-1">
                                              <textarea
                                                id={`respuesta-${q.id}`}
                                                name={`respuesta-${q.id}`}
                                                aria-label="Escribe tu respuesta a la pregunta"
                                                value={draftAnswers[q.id] ?? ''}
                                                onChange={(e) => setDraftAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                                                rows={3}
                                                className="min-h-[80px] w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                                                placeholder="Escribe tu respuesta…"
                                              />
                                              <p className="mt-1 text-xs text-red-600 font-medium">
                                                Importante: No incluyas teléfonos, emails, direcciones o enlaces externos.
                                              </p>
                                            </div>
                                            <div className="flex flex-shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                                              <div className="flex items-center justify-end gap-2 sm:justify-start">
                                                <EmojiPicker
                                                  popupClassName="right-0 sm:left-0 origin-top-right sm:origin-top-left"
                                                  onEmojiSelect={(emoji) => {
                                                    setDraftAnswers((p) => ({ ...p, [q.id]: (p[q.id] || '') + emoji }));
                                                  }}
                                                />
                                                <button
                                                  type="submit"
                                                  disabled={savingQuestionIds.has(q.id)}
                                                  className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed sm:min-w-[160px]"
                                                >
                                                  {savingQuestionIds.has(q.id) ? 'Enviando…' : 'Enviar respuesta'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </form>
                                      )}
                                    </div>

                                    {/* Botón eliminar (solo para preguntas del usuario como comprador) */}
                                    {isQuestionAsBuyer && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          // Aquí puedes agregar lógica para eliminar si es necesario
                                        }}
                                        className="absolute right-4 top-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-200"
                                        aria-label="Eliminar"
                                        title="Eliminar"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M18 6 6 18M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


