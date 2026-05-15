import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { effectiveUserId } = await requireAuth(req);

    const admin = supabaseAdmin();
    const res: any = await admin
      .from('support_conversations')
      .select('id,created_by,subject,status,last_message_at,created_at,updated_at')
      .eq('created_by', effectiveUserId)
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar soporte. Ejecuta `supabase_support_chat.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const resp = NextResponse.json({ ok: true, conversations: (res.data as any[]) ?? [] });
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
    const { effectiveUserId } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as { subject?: string };
    const subject = String(body?.subject || '').trim();
    if (subject.length < 3) return NextResponse.json({ error: 'Escribe un asunto (mínimo 3 caracteres).' }, { status: 400 });
    if (subject.length > 120) return NextResponse.json({ error: 'Asunto demasiado largo (máx. 120).' }, { status: 400 });

    const admin = supabaseAdmin();
    const ins: any = await admin
      .from('support_conversations')
      .insert([{ created_by: effectiveUserId, subject, status: 'open' }])
      .select('id,created_by,subject,status,last_message_at,created_at,updated_at')
      .single();

    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar soporte. Ejecuta `supabase_support_chat.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    const resp = NextResponse.json({ ok: true, conversation: ins.data });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
