import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
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

    const status = String(req.nextUrl.searchParams.get('status') || '').trim(); // open|closed
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 80)));
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

    // Compatibilidad: schema PRO (assigned/last_read_*) puede no existir aún.
    let convRes: any = admin
      .from('support_conversations')
      .select('id,created_by,subject,status,last_message_at,created_at,updated_at,assigned_admin_id,assigned_at,last_read_by_admin_at,last_read_by_user_at')
      .order('last_message_at', { ascending: false })
      .limit(limit);
    if (status) convRes = convRes.eq('status', status);
    let res: any = await convRes;

    if (res?.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        // fallback legacy (sin campos PRO)
        convRes = admin
          .from('support_conversations')
          .select('id,created_by,subject,status,last_message_at,created_at,updated_at')
          .order('last_message_at', { ascending: false })
          .limit(limit);
        if (status) convRes = convRes.eq('status', status);
        res = await convRes;
      }
    }

    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar soporte. Ejecuta `supabase_support_chat.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    let conversations = (res.data as any[]) ?? [];

    // Preview del último mensaje por conversación (estilo WhatsApp)
    const convIds = Array.from(new Set(conversations.map((c) => String(c?.id || '')).filter(Boolean)));
    const lastByConv: Record<string, { body: string; sender_role: string; created_at: string }> = {};
    if (convIds.length > 0) {
      const mRes: any = await admin
        .from('support_messages')
        .select('conversation_id,body,sender_role,created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(2000, convIds.length * 20));
      if (!mRes?.error && Array.isArray(mRes.data)) {
        for (const m of mRes.data as any[]) {
          const cid = String(m?.conversation_id || '').trim();
          if (!cid) continue;
          if (lastByConv[cid]) continue; // ya capturamos el más reciente por conversación
          lastByConv[cid] = {
            body: String(m?.body || ''),
            sender_role: String(m?.sender_role || ''),
            created_at: String(m?.created_at || ''),
          };
        }
      }
    }

    // Enriquecer nombres (best-effort)
    const userIds = Array.from(new Set(conversations.map((c) => String(c?.created_by || '')).filter(Boolean)));
    const nameById: Record<string, string> = {};
    const planById: Record<string, string> = {};
    if (userIds.length > 0) {
      let profRes: any = await admin.from('profiles').select('id,full_name,nickname,username,plan_type,pro_subscription_end').in('id', userIds);
      if (profRes.error) {
        const code = String((profRes.error as any)?.code || '');
        const msg = String((profRes.error as any)?.message || '').toLowerCase();
        if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
          profRes = await admin.from('profiles').select('id,full_name').in('id', userIds);
        }
      }
      if (!profRes.error && Array.isArray(profRes.data)) {
        for (const p of profRes.data as any[]) {
          const id = String(p?.id || '').trim();
          if (!id) continue;
          const name =
            String(p?.full_name || '').trim() ||
            String(p?.nickname || '').trim() ||
            String(p?.username || '').trim() ||
            `${id.slice(0, 6)}…`;
          nameById[id] = name;
          // Detect plan: check if pro/platinum subscription is still valid
          const rawPlan = String(p?.plan_type || 'basic').toLowerCase();
          const endStr = String(p?.pro_subscription_end || '').trim();
          if ((rawPlan === 'pro' || rawPlan === 'platinum') && endStr) {
            const expired = new Date(endStr).getTime() < Date.now();
            planById[id] = expired ? 'basic' : rawPlan;
          } else {
            planById[id] = rawPlan === 'pro' || rawPlan === 'platinum' ? rawPlan : 'basic';
          }
        }
      }
    }

    if (q) {
      conversations = conversations.filter((c) => {
        const subj = String(c?.subject || '').toLowerCase();
        const uid = String(c?.created_by || '');
        const name = String(nameById[uid] || '').toLowerCase();
        return subj.includes(q) || uid.toLowerCase().includes(q) || name.includes(q);
      });
    }

    // Señal simple de “pendiente”: último mensaje del user y conversación abierta
    const unreadCountById: Record<string, number> = {};
    const needsReplyById: Record<string, boolean> = {};

    const readByConv: Record<string, number> = {};
    for (const c of conversations) {
      const cid = String((c as any)?.id || '').trim();
      if (!cid) continue;
      const t = String((c as any)?.last_read_by_admin_at || '').trim();
      readByConv[cid] = t ? new Date(t).getTime() : 0;
    }

    // Best-effort: contar no leídos usando el "batch" ya traído (hasta 20 por conv aprox)
    if (convIds.length > 0) {
      const mRes2: any = await admin
        .from('support_messages')
        .select('conversation_id,sender_role,created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(4000, convIds.length * 40));
      if (!mRes2?.error && Array.isArray(mRes2.data)) {
        for (const m of mRes2.data as any[]) {
          const cid = String(m?.conversation_id || '').trim();
          if (!cid) continue;
          const role = String(m?.sender_role || '').toLowerCase();
          if (role !== 'user') continue;
          const mt = new Date(String(m?.created_at || '')).getTime();
          const rt = readByConv[cid] || 0;
          if (Number.isFinite(mt) && mt > rt) unreadCountById[cid] = (unreadCountById[cid] || 0) + 1;
        }
      }
    }

    for (const c of conversations) {
      const cid = String((c as any)?.id || '').trim();
      if (!cid) continue;
      const st = String((c as any)?.status || '').toLowerCase();
      const last = lastByConv[cid];
      const lastRole = String(last?.sender_role || '').toLowerCase();
      const unread = Number(unreadCountById[cid] || 0) || 0;
      needsReplyById[cid] = (st === 'open' && lastRole === 'user') || unread > 0;
    }

    const resp = NextResponse.json({ ok: true, conversations, nameById, planById, lastByConv, needsReplyById, unreadCountById });
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
    const { admin } = guard;

    const body = (await req.json().catch(() => ({}))) as { conversationId?: string; action?: 'close' | 'open' };
    const conversationId = String(body?.conversationId || '').trim();
    const action = String(body?.action || '').trim() as 'close' | 'open';
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    if (!['close', 'open'].includes(action)) return NextResponse.json({ error: 'action inválida' }, { status: 400 });

    const nextStatus = action === 'close' ? 'closed' : 'open';

    // Si se está cerrando el chat, borrar todos los mensajes de la conversación
    if (action === 'close') {
      const deleteMessages: any = await admin.from('support_messages').delete().eq('conversation_id', conversationId);
      if (deleteMessages.error) {
        // Si falla el borrado de mensajes, continuar de todas formas (puede que la tabla no exista o haya un problema de permisos)
        console.error('Error al borrar mensajes al cerrar chat:', deleteMessages.error);
        // No retornamos error aquí, solo logueamos, para que el cierre del chat se complete
      }
    }

    const upd: any = await admin.from('support_conversations').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', conversationId);
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

    const resp = NextResponse.json({ ok: true, status: nextStatus });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

