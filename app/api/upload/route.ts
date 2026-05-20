import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { uploadImageToR2, isR2Configured } from '@/lib/r2.service';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// Upload API — GoVendy
// Primary:  Cloudflare R2  (WebP compression 260/520/1080px)
// Fallback: Supabase Storage (for verification docs / payment proofs)
// ═══════════════════════════════════════════════════════════════════════════════

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function mimeFromFilename(name: string): string | null {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    jfif: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    bmp: 'image/bmp', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff',
    svg: 'image/svg+xml',
  };
  return map[ext] ?? null;
}

function mimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  
  // SVG detection by looking at text contents
  const startText = buf.slice(0, 100).toString('utf-8').trim().toLowerCase();
  if (startText.includes('<svg') || startText.includes('<?xml')) {
    return 'image/svg+xml';
  }
  
  return null;
}

function isImage(file: File, buf: Buffer): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  if (t === 'text/xml' || t === 'application/xml' || t === 'image/svg+xml') return true;
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (ext === 'svg') return true;
  if (t === '' || t === 'application/octet-stream') return !!(mimeFromFilename(file.name) || mimeFromMagic(buf));
  return false;
}

async function uploadToSupabaseAdmin(file: File, folder: string, bucket: string): Promise<string> {
  const admin = supabaseAdmin();
  const { error: bucketError } = await admin.storage.getBucket(bucket);
  if (bucketError) {
    await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
  }
  const buf  = Buffer.from(await file.arrayBuffer());
  const path = `${sanitize(folder)}/${Date.now()}-${Math.random().toString(16).slice(2)}-${sanitize(file.name || 'image')}`;
  let contentType = file.type || mimeFromFilename(file.name) || mimeFromMagic(buf) || 'application/octet-stream';
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  if (ext === 'svg' || contentType === 'text/xml' || contentType === 'application/xml') {
    contentType = 'image/svg+xml';
  }
  const up   = await admin.storage.from(bucket).upload(path, buf, { contentType, upsert: false });
  if (up.error) throw up.error;
  const pub = admin.storage.from(bucket).getPublicUrl(path);
  if (!pub.data.publicUrl) throw new Error('No public URL from Supabase Storage');
  return pub.data.publicUrl;
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // ── Parse form data ───────────────────────────────────────────────────────
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const kind     = String(formData.get('kind') ?? '');
    const folder   = String((formData.get('folder') ?? kind) || 'products');

    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 15 MB por imagen' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Verification / payment docs → Supabase Storage (no R2) ───────────────
    if (kind === 'verification' || kind === 'payment_proof' || kind === 'support_attachment') {
      const bucket = kind === 'verification' ? 'identificaciones' : 'upload';
      const supaFolder = kind === 'verification' ? 'verification' : kind === 'payment_proof' ? 'payment-proofs' : 'support-attachments';
      const url = await uploadToSupabaseAdmin(file, supaFolder, bucket);
      return NextResponse.json({ url, provider: 'supabase' });
    }

    // ── All product images → Cloudflare R2 ───────────────────────────────────
    if (!isImage(file, buffer)) {
      return NextResponse.json({ error: 'Solo se permiten imágenes (PNG, JPG, WebP, GIF…)' }, { status: 400 });
    }

    if (!isR2Configured()) {
      // Fallback to Supabase if R2 not configured in this environment
      const url = await uploadToSupabaseAdmin(file, folder, 'upload');
      return NextResponse.json({ url, provider: 'supabase_fallback' });
    }

    const result = await uploadImageToR2(buffer, folder, file.name);
    return NextResponse.json({
      url:      result.url,          // URL de la variante large (uso en BD)
      key:      result.key,          // Base-key para borrado cascada
      variants: result.variants,     // { thumb, medium, large }
      provider: 'r2',
    });

  } catch (e: any) {
    console.error('[Upload] Error:', e);
    return NextResponse.json({ error: e.message || 'Error al subir imagen' }, { status: 500 });
  }
}
