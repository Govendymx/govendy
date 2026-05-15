import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Auth check
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
    if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      userId,
      manual_reputation_score,
      manual_sales_count,
      admin_notes,
      is_official_store,
      official_store_name,
      official_store_banner_url,
      official_store_brand_color,
      is_wholesaler,
      is_manufacturer
    } = body;

    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const updateData: any = {
      manual_reputation_score: manual_reputation_score === '' ? null : Number(manual_reputation_score),
      manual_sales_count: manual_sales_count === '' ? null : Number(manual_sales_count),
      admin_notes: admin_notes || null,
      is_official_store: !!is_official_store,
      official_store_name: official_store_name || null,
      official_store_banner_url: official_store_banner_url || null,
      official_store_brand_color: official_store_brand_color || null,
      is_wholesaler: !!is_wholesaler,
      is_manufacturer: !!is_manufacturer,
    };

    const { error } = await admin.from('profiles').update(updateData).eq('id', userId);

    if (error) {
      console.error('[UPDATE AUDIT DB ERROR]', error);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[UPDATE AUDIT]', e);
    return NextResponse.json({ error: e.message || 'Error updating audit fields' }, { status: 500 });
  }
}
