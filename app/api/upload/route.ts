import { NextRequest, NextResponse } from 'next/server';
import { uploadImageWithWatermark } from '@/lib/cloudinary/utils';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth) return null;
  const [type, token] = auth.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function isBucketNotFoundError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  const code = String((err as any)?.error || (err as any)?.code || '').toLowerCase();
  return msg.includes('bucket not found') || code.includes('bucket') && msg.includes('not found');
}

function isRlsViolationError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return msg.includes('row-level security') || msg.includes('rls');
}

function bucketForKind(kind: string) {
  // Usamos buckets existentes en tu proyecto:
  // - identificaciones: documentos de verificación (INE)
  // - upload: imágenes de productos/publicaciones
  if (kind === 'verification') return 'identificaciones';
  // comprobantes de pago offline (ticket/baúcher)
  if (kind === 'payment_proof') return 'upload';
  // adjuntos de soporte (fotos/archivos)
  if (kind === 'support_attachment') return 'upload';
  return 'upload';
}

async function ensureBucketExistsAdmin(bucket: string) {
  const admin = supabaseAdmin();
  const exists = await admin.storage.getBucket(bucket).catch(() => null);
  if (!exists?.data) {
    await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
  }
}

async function uploadToSupabaseStorageAdmin(file: File, folder: string, bucket: string) {
  const admin = supabaseAdmin();

  // Crear bucket si no existe (public)
  const exists = await admin.storage.getBucket(bucket).catch(() => null);
  if (!exists?.data) {
    await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = sanitizeFileName(file.name || 'image');
  const safeFolder = sanitizeFileName(folder || 'uploads');
  const path = `${safeFolder}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

  const up = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (up.error) throw up.error;

  const pub = admin.storage.from(bucket).getPublicUrl(path);
  const url = pub.data.publicUrl;
  if (!url) throw new Error('No se pudo obtener la URL pública del storage.');
  return url;
}

async function uploadToSupabaseStorageUser(file: File, folder: string, bucket: string, token: string) {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error('Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = sanitizeFileName(file.name || 'image');
  const safeFolder = sanitizeFileName(folder || 'uploads');
  const path = `${safeFolder}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

  const doUpload = async () => {
    return await client.storage.from(bucket).upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  };

  let up = await doUpload();
  if (up.error && isBucketNotFoundError(up.error)) {
    // Intentar crear el bucket con service role (si está configurado) y reintentar.
    try {
      await ensureBucketExistsAdmin(bucket);
      up = await doUpload();
    } catch {
      // Ignorar: si no hay service role, caeremos al mensaje friendly.
    }
  }

  if (up.error) {
    if (isBucketNotFoundError(up.error)) {
      throw new Error(
        `Bucket not found. Crea el bucket '${bucket}' en Supabase: Storage → New bucket → nombre: ${bucket} → Public. ` +
          'O configura SUPABASE_SERVICE_ROLE_KEY para que se cree automáticamente.',
      );
    }
    if (isRlsViolationError(up.error)) {
      // Si el bucket no tiene policies para INSERT, usamos service_role (si existe) como fallback.
      try {
        return await uploadToSupabaseStorageAdmin(file, folder, bucket);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        throw new Error(
          (String((up.error as any)?.message || up.error) || 'RLS bloqueó el upload.') +
            '\n\nSolución: ejecuta `supabase_storage_policies_pocket.sql` en Supabase, o configura `SUPABASE_SERVICE_ROLE_KEY` correctamente. ' +
            (msg ? `\n\nDetalle service_role: ${msg}` : ''),
        );
      }
    }
    throw up.error;
  }

  const pub = client.storage.from(bucket).getPublicUrl(path);
  const publicUrl = pub.data.publicUrl;
  if (!publicUrl) throw new Error('No se pudo obtener la URL pública del storage.');
  return publicUrl;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kind = String(formData.get('kind') ?? '');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Ajustes por tipo de subida
    const isVerification = kind === 'verification';
    const isPaymentProof = kind === 'payment_proof';
    const isSupportAttachment = kind === 'support_attachment';
    const folder = isVerification ? 'verification' : isPaymentProof ? 'payment-proofs' : isSupportAttachment ? 'support-attachments' : 'products';
    const watermark = isVerification || isPaymentProof || isSupportAttachment ? undefined : process.env.CLOUDINARY_WATERMARK;
    const bucket = bucketForKind(kind);

    let imageUrl: string;

    // Para verificación (INE), comprobantes y adjuntos de soporte, no necesitamos Cloudinary/marca de agua.
    // Intentamos Storage con token del usuario y hacemos fallback a service_role si RLS bloquea.
    if (isVerification || isPaymentProof || isSupportAttachment) {
      const token = getBearerToken(request);
      if (token) {
        imageUrl = await uploadToSupabaseStorageUser(file, folder, bucket, token);
      } else {
        imageUrl = await uploadToSupabaseStorageAdmin(file, folder, bucket);
      }
      return NextResponse.json({ url: imageUrl });
    }

    try {
      // Preferimos Cloudinary (marca de agua)
      imageUrl = await uploadImageWithWatermark(file, {
        folder,
        watermark,
      });
    } catch (err: unknown) {
      // Fallback a Supabase Storage si Cloudinary no está configurado
      const msg = err instanceof Error ? err.message : '';
      const looksLikeCloudinaryMissing =
        msg.includes('Faltan variables de Cloudinary') ||
        msg.toLowerCase().includes('cloudinary') ||
        msg.toLowerCase().includes('cloud_name');

      if (!looksLikeCloudinaryMissing) throw err;

      // Si no hay service role, intentamos subir con el token del usuario
      const token = getBearerToken(request);
      if (token) {
        imageUrl = await uploadToSupabaseStorageUser(file, folder, bucket, token);
      } else {
        imageUrl = await uploadToSupabaseStorageAdmin(file, folder, bucket);
      }
    }

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to upload image';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
