import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

type Body = {
  title: string;
  body: string;
  image_url?: string | null;
  link_url?: string | null;
  audience: 'all' | 'users';
  userIds?: string[];
};

async function listAllUserIds(admin: any) {
  // Fuente de verdad: auth.users (incluye compradores sin perfil completo).
  // Requiere service_role (ya lo estamos usando en supabaseAdmin()).
  const ids: string[] = [];

  try {
    // supabase-js v2: admin.auth.admin.listUsers({ page, perPage })
    const perPage = 1000;
    for (let page = 1; page <= 10; page++) {
      const res: any = await admin.auth.admin.listUsers({ page, perPage });
      if (res?.error) throw res.error;
      const users = ((res?.data?.users as any[]) ?? []) as any[];
      for (const u of users) {
        const id = String(u?.id || '').trim();
        if (id) ids.push(id);
      }
      if (users.length < perPage) break;
      if (ids.length >= 5000) break; // guardrail
    }
    if (ids.length > 0) return ids;
  } catch {
    // Fallback: profiles (legacy / si auth.admin no está disponible por alguna razón)
  }

  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const res: any = await admin.from('profiles').select('id').range(offset, offset + pageSize - 1);
    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '');
      if (code === '42P01' || msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
        throw new Error('No existe la tabla `profiles`. No puedo listar usuarios para envío masivo.');
      }
      throw new Error(res.error.message);
    }
    const rows = (res.data as any[]) ?? [];
    for (const r of rows) {
      const id = String(r?.id || '').trim();
      if (id) ids.push(id);
    }
    if (rows.length < pageSize) break;
    if (ids.length >= 5000) break; // guardrail
  }
  return ids;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const title = String(body?.title || '').trim();
    const text = String(body?.body || '').trim();
    const image_url = String(body?.image_url || '').trim();
    const link_url = String(body?.link_url || '').trim();
    const audience = String(body?.audience || '').trim() as Body['audience'];

    if (title.length < 3) return NextResponse.json({ error: 'title inválido (mín. 3 caracteres).' }, { status: 400 });
    if (title.length > 80) return NextResponse.json({ error: 'title demasiado largo (máx. 80).' }, { status: 400 });
    if (text.length < 1) return NextResponse.json({ error: 'body es requerido.' }, { status: 400 });
    if (text.length > 500) return NextResponse.json({ error: 'body demasiado largo (máx. 500).' }, { status: 400 });
    if (!['all', 'users'].includes(audience)) return NextResponse.json({ error: 'audience inválido.' }, { status: 400 });

    let recipients: string[] = [];
    if (audience === 'all') {
      recipients = await listAllUserIds(admin);
      if (recipients.length >= 5000) {
        // guardrail para no saturar
        return NextResponse.json(
          {
            error:
              'Hay muchos usuarios para envío masivo en un solo request (>= 5000). Envíalo por segmentos o te preparo un sistema por lotes/cola.',
          },
          { status: 400 },
        );
      }
    } else {
      const raw = Array.isArray(body?.userIds) ? body.userIds : [];
      recipients = raw.map(String).map((x) => x.trim()).filter((x) => x && isUuid(x));
      if (recipients.length === 0) return NextResponse.json({ error: 'userIds requerido para audience=users.' }, { status: 400 });
      if (recipients.length > 200) return NextResponse.json({ error: 'Máximo 200 usuarios por envío.' }, { status: 400 });
    }

    const data: any = {
      kind: 'admin_announcement',
      image_url: image_url || null,
      link_url: link_url || null,
      sent_by: requesterId,
      sent_at: new Date().toISOString(),
    };

    let sent = 0;
    const errors: Array<{ user_id: string; code?: string; message?: string }> = [];

    // Insertar en lotes (secuencial para evitar rate limits)
    for (const uid of recipients) {
      const r = await insertNotificationBestEffort(admin, {
        user_id: uid,
        type: 'admin_announcement',
        title,
        body: text,
        data,
        is_read: false,
      });
      if (r.ok) sent += 1;
      else errors.push({ user_id: uid, code: (r as any).code, message: (r as any).message });
    }

    const resp = NextResponse.json({ ok: true, sent, failed: errors.length, errors });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error sending announcement' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

