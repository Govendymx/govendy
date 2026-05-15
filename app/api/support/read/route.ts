import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

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

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as { conversationId?: string };
    const conversationId = String(body?.conversationId || '').trim();
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });

    const admin = supabaseAdmin();
    const cRes: any = await admin.from('support_conversations').select('id,created_by').eq('id', conversationId).maybeSingle();
    if (cRes.error) return NextResponse.json({ error: cRes.error.message }, { status: 400 });
    if (!cRes.data) return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 });
    if (String((cRes.data as any)?.created_by || '') !== effectiveUserId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const upd: any = await admin
      .from('support_conversations')
      .update({ last_read_by_user_at: now, updated_at: now })
      .eq('id', conversationId);

    if (upd?.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Faltan columnas PRO. Ejecuta la versión actualizada de `supabase_support_chat.sql` en Supabase.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    // Best-effort: avisar en tiempo real al admin (leído)
    void broadcastSupportEvent(conversationId, { kind: 'read', by: 'user' });

    const resp = NextResponse.json({ ok: true });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

