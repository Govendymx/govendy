
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/service';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: 'Missing token', status: 401 };

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: adminUser } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) return { error: 'Forbidden', status: 403 };

  return { admin, user };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { userIds, message } = await req.json();

    if (!userIds || !Array.isArray(userIds) || !message) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const results = [];

    // Send in parallel (limit concurrency if needed, but for <100 ok)
    for (const uid of userIds) {
      try {
        await notify(admin, {
          user_id: uid,
          type: 'system',
          title: 'Aviso Importante PRO',
          message: message,
          link_to: '/vender' // Or /admin-messages if exists
        });
        results.push({ id: uid, status: 'sent' });
      } catch (e: any) {
        results.push({ id: uid, status: 'error', error: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
