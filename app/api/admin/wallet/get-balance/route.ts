import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    // Validate token -> user
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (admin_users or profiles.is_admin/role)
    const admin = supabaseAdmin();
    let isAdmin = false;
    try {
      const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
      if (adminRow) isAdmin = true;
    } catch {}
    if (!isAdmin) {
      try {
        const { data: p } = await admin.from('profiles').select('is_admin, role').eq('id', userData.user.id).maybeSingle();
        if (p?.is_admin || p?.role === 'admin') isAdmin = true;
      } catch {}
    }
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data: wallet, error } = await admin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ 
      wallet: wallet || { balance: 0, is_frozen: false } 
    });

  } catch (err: any) {
    console.error('[Admin Wallet Get] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
