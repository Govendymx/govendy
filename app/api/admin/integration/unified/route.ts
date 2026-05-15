import { NextRequest, NextResponse } from 'next/server';
import { syncEngine } from '@/lib/integration';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  try {
    // Auth Check
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Verify if user is admin in 'admin_users' table if needed, 
    // but usually this endpoint is protected by middleware or similar. 
    // For now, relying on valid auth token + basic admin check if we had it.

    const itemsResult = await syncEngine.aggregateItems(user.id);
    const metrics = await syncEngine.aggregateMetrics();

    return NextResponse.json({
      ok: true,
      items: itemsResult.items,
      metrics: metrics,
      errors: itemsResult.errors
    });

  } catch (e: any) {
    console.error('[IntegrationAPI] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
