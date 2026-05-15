import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const userId = userData.user.id;

    const { data: adminRow, error: adminErr } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
    if (adminErr) return NextResponse.json({ error: adminErr.message }, { status: 400 });
    if (!adminRow) return NextResponse.json({ error: 'No tienes permisos de administrador.' }, { status: 403 });

    const q = req.nextUrl.searchParams.get('q')?.trim() || '';
    const moderation = req.nextUrl.searchParams.get('moderation');
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 100)));

    let query = admin
      .from('listings')
      .select(
        'id,public_id,title,price,currency,status,sale_type,seller_id,created_at,expires_at,view_count,auction_end_at,auction_highest_bid,auction_highest_bidder_id,is_deleted,deleted_at,attributes',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (moderation === 'review_needed') {
      // Filter by JSONB attribute
      query = query.eq('attributes->>moderation_status', 'review_needed');
    }

    if (q) {
      const parts = [`title.ilike.%${q}%`, `public_id.ilike.%${q}%`];
      if (isUuid(q)) parts.push(`id.eq.${q}`);
      query = query.or(parts.join(','));
    }

    const { data, error } = await query;
    if (error) {
      const code = String((error as any)?.code || '');
      const msg = String((error as any)?.message || '');
      // Si aún no existe public_id, fallback.
      if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
        let q2 = admin
          .from('listings')
          .select('id,title,price,currency,status,sale_type,seller_id,created_at,attributes')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (q) {
          const parts2 = [`title.ilike.%${q}%`];
          if (isUuid(q)) parts2.push(`id.eq.${q}`);
          q2 = q2.or(parts2.join(','));
        }
        const r2 = await q2;
        if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 400 });
        return NextResponse.json({ ok: true, rows: r2.data ?? [] });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

