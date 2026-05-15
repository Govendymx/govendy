import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { listingId?: string };
    const listingId = String(body?.listingId || '').trim();
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

    const admin = supabaseAdmin();

    // Intentar incrementar share_count (si existe)
    const { data, error } = await admin.from('listings').select('id,share_count').eq('id', listingId).maybeSingle();
    if (error) {
      const code = String((error as any)?.code || '');
      const msg = String((error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('does not exist')) {
        // Esquema viejo: no rompemos el share
        return NextResponse.json({ ok: true, skipped: true });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });

    const current = Number((data as any).share_count ?? 0) || 0;
    const upd = await admin.from('listings').update({ share_count: current + 1 }).eq('id', listingId);
    if (upd.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('does not exist')) return NextResponse.json({ ok: true, skipped: true });
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

