import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function isAdminUser(admin: any, userId: string) {
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

async function ensureAllowed(admin: any, orderId: string, userId: string) {
  const { data: row, error } = await admin.from('orders').select('id,buyer_id,seller_id').eq('id', orderId).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 404, error: 'Orden no encontrada.' };
  const buyerId = String((row as any)?.buyer_id || '').trim();
  const sellerId = String((row as any)?.seller_id || '').trim();
  const adminOk = await isAdminUser(admin, userId).catch(() => false);
  if (!adminOk && buyerId !== userId && sellerId !== userId) return { ok: false as const, status: 403, error: 'No autorizado.' };
  return { ok: true as const, buyerId, sellerId, isAdmin: adminOk };
}

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = await requireAuth(req);

    const form = await req.formData();
    const orderId = String(form.get('orderId') || '').trim();
    const file = form.get('file') as File | null;

    if (!orderId || !isUuid(orderId)) return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: 'Archivo demasiado grande (máx 15MB).' }, { status: 400 });

    const contentType = String(file.type || '').toLowerCase();
    const isImage = contentType.startsWith('image/');
    const isPdf = contentType === 'application/pdf';
    if (!isImage && !isPdf) return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo imágenes o PDF.' }, { status: 400 });

    const admin = supabaseAdmin();
    const allowed = await ensureAllowed(admin, orderId, effectiveUserId);
    if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

    const bucket = 'upload';
    const exists = await admin.storage.getBucket(bucket).catch(() => null);
    if (!exists?.data) {
      await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeFileName(file.name || (isPdf ? 'documento.pdf' : 'foto.jpg'));
    const path = `order-chat/${orderId}/${Date.now()}-${safeName}`;

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

