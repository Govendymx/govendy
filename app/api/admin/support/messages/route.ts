import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';

export const dynamic = 'force-dynamic';

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

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function looksLikeLink(text: string) {
  const t = text.toLowerCase();
  if (t.includes('http://') || t.includes('https://')) return true;
  if (t.includes('www.')) return true;
  if (/\b[a-z0-9-]+\.(com|mx|net|org|io|app|me|gg|ly|co|tv|xyz)\b/i.test(t)) return true;
  if (t.includes('wa.me') || t.includes('t.me')) return true;
  return false;
}

function looksLikePhone(text: string) {
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 10) return true;
  if (/\b\d{7,}\b/.test(text)) return true;
  return false;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const conversationId = String(req.nextUrl.searchParams.get('conversationId') || '').trim();
    const limit = Math.max(1, Math.min(400, Number(req.nextUrl.searchParams.get('limit') || 200)));
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });

    // Compatibilidad: schema PRO puede incluir last_read_* / assigned_*
    const selectFull =
      'id,created_by,subject,status,last_message_at,created_at,updated_at,assigned_admin_id,assigned_at,last_read_by_admin_at,last_read_by_user_at,last_delivered_to_user_at';
    const selectBase = 'id,created_by,subject,status,last_message_at,created_at,updated_at';

    let cRes: any = await admin.from('support_conversations').select(selectFull).eq('id', conversationId).maybeSingle();
    if (cRes?.error) {
      const code = String((cRes.error as any)?.code || '');
      const msg = String((cRes.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        cRes = await admin.from('support_conversations').select(selectBase).eq('id', conversationId).maybeSingle();
      }
    }
    if (cRes.error) return NextResponse.json({ error: cRes.error.message }, { status: 400 });
    if (!cRes.data) return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });

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
      if (mRes.error) {
        const code2 = String((mRes.error as any)?.code || '');
        const msg2 = String((mRes.error as any)?.message || '').toLowerCase();
        if (code2 === '42P01' || msg2.includes('does not exist') || msg2.includes('relation')) {
          return NextResponse.json({ error: 'Falta configurar soporte. Ejecuta `supabase_support_chat.sql` en Supabase.' }, { status: 400 });
        }
        return NextResponse.json({ error: mRes.error.message }, { status: 400 });
      }
    }
    
    // Asegurar que los mensajes tengan valores por defecto para campos de adjuntos si no existen
    const messages = ((mRes.data as any[]) ?? []).map((msg: any) => ({
      ...msg,
      attachment_url: msg.attachment_url || null,
      attachment_name: msg.attachment_name || null,
      attachment_mime: msg.attachment_mime || null,
      attachment_size: msg.attachment_size || null,
    }));

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
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

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

    // Bloqueo anti-contacto también para soporte (regla global)
    if (message && (looksLikeLink(message) || looksLikePhone(message))) {
      return NextResponse.json({ error: 'Por seguridad no se permiten enlaces ni números de teléfono.' }, { status: 400 });
    }

    // Asegurar que exista conversación
    const cRes: any = await admin.from('support_conversations').select('id,created_by,subject,status').eq('id', conversationId).maybeSingle();
    if (cRes.error) return NextResponse.json({ error: cRes.error.message }, { status: 400 });
    if (!cRes.data) return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });

    // Construir el objeto de inserción solo con campos que existen
    const insertData: any = {
      conversation_id: conversationId,
      sender_id: requesterId,
      sender_role: 'admin',
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
          sender_id: requesterId,
          sender_role: 'admin',
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

    // Re-abrir conversación al responder
    await admin.from('support_conversations').update({ status: 'open' }).eq('id', conversationId);

    // Best-effort: avisar en tiempo real (no depende de RLS)
    void broadcastSupportEvent(conversationId, { kind: 'message', messageId: String(savedMessage?.id || ''), by: 'admin' });

    // Notificar al usuario (best-effort)
    try {
      const userId = String((cRes.data as any)?.created_by || '').trim();
      const subject = String((cRes.data as any)?.subject || 'Soporte').trim();
      const snippet = message.trim().slice(0, 140);
      if (userId) {
        await insertNotificationBestEffort(admin, {
          user_id: userId,
          type: 'support_reply',
          title: 'Soporte respondió',
          body: `${subject}: ${snippet || 'Tienes una nueva respuesta.'}`,
          data: { conversationId, by: requesterId },
          is_read: false,
        });
      }
    } catch {
      // noop
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

