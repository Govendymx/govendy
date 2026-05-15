import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function requireUserFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  return { ok: true as const, userId: userData.user.id };
}

async function isAdminUser(admin: any, userId: string) {
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

async function ensureAllowed(admin: any, disputeId: string, userId: string) {
  const { data: row, error } = await admin.from('disputes').select('id,buyer_id,seller_id').eq('id', disputeId).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 404, error: 'Disputa no encontrada.' };
  const buyerId = String((row as any)?.buyer_id || '').trim();
  const sellerId = String((row as any)?.seller_id || '').trim();
  const adminOk = await isAdminUser(admin, userId).catch(() => false);
  if (!adminOk && buyerId !== userId && sellerId !== userId) return { ok: false as const, status: 403, error: 'No autorizado.' };
  return { ok: true as const, buyerId, sellerId, isAdmin: adminOk };
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const form = await req.formData();
    const disputeId = String(form.get('disputeId') || '').trim();
    const file = form.get('file') as File | null;

    if (!disputeId || !isUuid(disputeId)) return NextResponse.json({ error: 'disputeId inválido' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: 'Archivo demasiado grande (máx 15MB).' }, { status: 400 });

    const contentType = String(file.type || '').toLowerCase();
    const isImage = contentType.startsWith('image/');
    const isPdf = contentType === 'application/pdf';
    if (!isImage && !isPdf) return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo imágenes o PDF.' }, { status: 400 });

    const admin = supabaseAdmin();
    const allowed = await ensureAllowed(admin, disputeId, guard.userId);
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

    const bucket = 'upload';
    const exists = await admin.storage.getBucket(bucket).catch(() => null);
    if (!exists?.data) {
      await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeFileName(file.name || (isPdf ? 'documento.pdf' : 'foto.jpg'));
    const path = `disputes/${disputeId}/${Date.now()}-${safeName}`;

    const up = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      upsert: false,
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

    const pub = admin.storage.from(bucket).getPublicUrl(path);
    const url = pub.data.publicUrl;
    if (!url) return NextResponse.json({ error: 'No se pudo obtener URL pública del archivo.' }, { status: 500 });

    const resp = NextResponse.json({
      ok: true,
      attachment: {
        url,
        name: safeName,
        contentType: file.type || null,
        size: file.size,
      },
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

