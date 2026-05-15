import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';



async function requireUser(req: NextRequest) {
  const { effectiveUserId } = await requireAuth(req);
  return { ok: true as const, userId: effectiveUserId };
}

async function broadcastSupportEvent(conversationId: string, payload: any = {}) {
  try {
    const admin = supabaseAdmin();
    const ch: any = admin.channel('support:events');
    await new Promise<void>((resolve) => {
      let done = false;
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, 1200);
      ch.subscribe((status: string) => {
        if (done) return;
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          done = true;
          clearTimeout(t);
          resolve();
        }
      });
    });
    await ch.send({ type: 'broadcast', event: 'support_event', payload: { conversationId, ...payload, t: Date.now() } });
    try {
      admin.removeChannel(ch);
    } catch {
      // noop
    }
  } catch {
    // noop
  }
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    const conversationId = String(req.nextUrl.searchParams.get('conversationId') || '').trim();
    const limit = Math.max(1, Math.min(400, Number(req.nextUrl.searchParams.get('limit') || 200)));
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });

    const admin = supabaseAdmin();
    const cRes: any = await admin.from('support_conversations').select('id,created_by,subject,status').eq('id', conversationId).maybeSingle();
    if (cRes.error) return NextResponse.json({ error: cRes.error.message }, { status: 400 });
    if (!cRes.data) return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });
    if (String((cRes.data as any)?.created_by || '') !== guard.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    // Intentar seleccionar con columnas de adjuntos (si existen)
    let mRes: any = await admin
      .from('support_messages')
      .select('id,conversation_id,sender_id,sender_role,body,attachment_url,attachment_name,attachment_mime,attachment_size,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Si falla por columnas faltantes, intentar sin las columnas de adjuntos
    if (mRes.error) {
      const code = String((mRes.error as any)?.code || '');
      const msg = String((mRes.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        // Intentar sin columnas de adjuntos
        mRes = await admin
          .from('support_messages')
          .select('id,conversation_id,sender_id,sender_role,body,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(limit);
      }
      if (mRes.error) return NextResponse.json({ error: mRes.error.message }, { status: 400 });
    }

    // Asegurar que los mensajes tengan valores por defecto para campos de adjuntos si no existen
    const messages = ((mRes.data as any[]) ?? []).map((msg: any) => ({
      ...msg,
      attachment_url: msg.attachment_url || null,
      attachment_name: msg.attachment_name || null,
      attachment_mime: msg.attachment_mime || null,
      attachment_size: msg.attachment_size || null,
    }));

    // Marcar como “entregado al usuario” (✓) cuando el cliente recibe el chat (best-effort)
    try {
      const now = new Date().toISOString();
      const upd: any = await admin.from('support_conversations').update({ last_delivered_to_user_at: now }).eq('id', conversationId);
      if (upd?.error) {
        const code = String((upd.error as any)?.code || '');
        const msg = String((upd.error as any)?.message || '').toLowerCase();
        // si falta la columna, no rompemos el flujo
        if (!(code === '42703' || msg.includes('column') || msg.includes('does not exist'))) {
          // noop
        }
      }
    } catch {
      // noop
    }

    // Best-effort: avisar en tiempo real al admin (recibido)
    void broadcastSupportEvent(conversationId, { kind: 'delivered' });

    const resp = NextResponse.json({ ok: true, conversation: cRes.data, messages });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);

    const body = (await req.json().catch(() => ({}))) as {
      conversationId?: string;
      message?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentMime?: string;
      attachmentSize?: number;
    };
    const conversationId = String(body?.conversationId || '').trim();
    const message = String(body?.message || '').trim();
    const attachmentUrl = String(body?.attachmentUrl || '').trim();
    const attachmentName = String(body?.attachmentName || '').trim();
    const attachmentMime = String(body?.attachmentMime || '').trim();
    const attachmentSize = Number(body?.attachmentSize ?? 0) || 0;
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    if (message.length < 1 && !attachmentUrl) return NextResponse.json({ error: 'Escribe un mensaje o adjunta un archivo.' }, { status: 400 });
    if (message.length > 800) return NextResponse.json({ error: 'Mensaje demasiado largo (máx. 800).' }, { status: 400 });


    const admin = supabaseAdmin();
    const cRes: any = await admin.from('support_conversations').select('id,created_by,subject,status').eq('id', conversationId).maybeSingle();
    if (cRes.error) return NextResponse.json({ error: cRes.error.message }, { status: 400 });
    if (!cRes.data) return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });
    if (String((cRes.data as any)?.created_by || '') !== guard.userId) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    // Construir el objeto de inserción solo con campos que existen
    const insertData: any = {
      conversation_id: conversationId,
      sender_id: guard.userId,
      sender_role: 'user',
      body: message,
    };

    // Solo agregar campos de adjuntos si tienen valor (y si las columnas existen)
    if (attachmentUrl) insertData.attachment_url = attachmentUrl;
    if (attachmentName) insertData.attachment_name = attachmentName;
    if (attachmentMime) insertData.attachment_mime = attachmentMime;
    if (attachmentSize) insertData.attachment_size = attachmentSize;

    // Intentar insertar con todas las columnas
    let ins: any = await admin
      .from('support_messages')
      .insert([insertData])
      .select('id,conversation_id,sender_id,sender_role,body,attachment_url,attachment_name,attachment_mime,attachment_size,created_at')
      .single();

    // Si falla por columnas faltantes, intentar sin ellas
    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        // Remover campos de adjuntos del insertData
        const insertDataBasic: any = {
          conversation_id: conversationId,
          sender_id: guard.userId,
          sender_role: 'user',
          body: message,
        };
        ins = await admin
          .from('support_messages')
          .insert([insertDataBasic])
          .select('id,conversation_id,sender_id,sender_role,body,created_at')
          .single();
      }
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    // Asegurar valores por defecto para campos de adjuntos
    const savedMessage = {
      ...ins.data,
      attachment_url: ins.data?.attachment_url || null,
      attachment_name: ins.data?.attachment_name || null,
      attachment_mime: ins.data?.attachment_mime || null,
      attachment_size: ins.data?.attachment_size || null,
    };

    // Si la conversación estaba cerrada, borrar todos los mensajes antes de reabrirlo (para empezar limpio)
    const currentStatus = String((cRes.data as any)?.status || '').toLowerCase();
    if (currentStatus === 'closed') {
      // Borrar todos los mensajes de la conversación para empezar limpio
      try {
        await admin.from('support_messages').delete().eq('conversation_id', conversationId);
      } catch (err) {
        // Si falla, continuar de todas formas (puede que la tabla no exista o haya un problema de permisos)
        console.warn('[SUPPORT MESSAGES] No se pudieron borrar mensajes previos:', err);
      }
    }

    // Re-abrir conversación al escribir
    await admin.from('support_conversations').update({ status: 'open' }).eq('id', conversationId);

    // Best-effort: avisar en tiempo real (no depende de RLS)
    void broadcastSupportEvent(conversationId, { kind: 'message', messageId: String(savedMessage?.id || ''), by: 'user' });

    // Auto-response with SLA based on user plan
    try {
      const profRes: any = await admin.from('profiles').select('plan_type,pro_subscription_end').eq('id', guard.userId).maybeSingle();
      let userPlan = 'basic';
      if (profRes?.data) {
        const rawPlan = String(profRes.data.plan_type || 'basic').toLowerCase();
        const endStr = String(profRes.data.pro_subscription_end || '').trim();
        if ((rawPlan === 'pro' || rawPlan === 'platinum') && endStr) {
          const expired = new Date(endStr).getTime() < Date.now();
          userPlan = expired ? 'basic' : rawPlan;
        } else {
          userPlan = rawPlan === 'pro' || rawPlan === 'platinum' ? rawPlan : 'basic';
        }
      }
      const isPremium = userPlan === 'pro' || userPlan === 'platinum';
      const slaText = isPremium
        ? '⚡ Prioridad: Tu plan ' + (userPlan === 'platinum' ? 'Platinum 👑' : 'Pro 🔵') + ' tiene atención prioritaria. Te responderemos en un máximo de 12 a 24 horas.'
        : '📩 Hemos recibido tu mensaje. Te responderemos en un máximo de 24 a 48 horas. ¡Gracias por tu paciencia!';

      const autoReplyData: any = {
        conversation_id: conversationId,
        sender_id: 'system',
        sender_role: 'admin',
        body: slaText,
      };
      try {
        await admin.from('support_messages').insert([autoReplyData]).select('id').single();
      } catch { /* best effort */ }
    } catch (slaErr) {
      console.error('[SUPPORT] SLA auto-reply error:', slaErr);
    }

    // Notificar admins (best-effort)
    try {
      const snippet = message.trim().slice(0, 140);
      const subject = String((cRes.data as any)?.subject || 'Soporte').trim();
      const { notifyAdmin } = await import('@/lib/notifications/admin');
      await notifyAdmin.supportTicketCreated({
        ticketId: conversationId,
        userId: guard.userId,
        subject: subject || 'Nuevo mensaje de soporte',
      });
    } catch (adminNotifyErr) {
      console.error('[SUPPORT MESSAGES] Error al notificar administradores:', adminNotifyErr);
    }

    const resp = NextResponse.json({ ok: true, message: savedMessage });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

