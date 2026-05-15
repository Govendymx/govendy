import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function checkAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Unauthorized');
  
  const admin = supabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');

  const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) throw new Error('Forbidden');
  return user;
}

export async function GET(req: NextRequest) {
  try {
    await checkAdmin(req);
    const { data } = await supabaseAdmin()
      .from('app_settings')
      .select('cashback_config')
      .eq('id', 1)
      .single();
    
    return NextResponse.json(data?.cashback_config || { enabled: false, percentage: 0, welcome_bonus: 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await checkAdmin(req);
    const body = await req.json();
    
    const { error } = await supabaseAdmin()
      .from('app_settings')
      .update({ cashback_config: body })
      .eq('id', 1);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
