import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// ═══════════════════════════════════════════════════════════════════════════════
// Cloudflare R2 Image Service — GoVendy
// Bucket: gopocket-images  (shared with GoPocket Live)
// Generates 3 WebP variants per image: thumb 260px / medium 520px / large 1080px
// ═══════════════════════════════════════════════════════════════════════════════

const cleanEnv = (v?: string) => (v || '').replace(/[\r\n]+/g, '').trim();

function getS3Client(): S3Client {
  const endpoint = cleanEnv(process.env.R2_ENDPOINT);
  const accessKeyId = cleanEnv(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanEnv(process.env.R2_SECRET_ACCESS_KEY);
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 env vars not configured (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
  }
  return new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });
}

function getPublicUrl(key: string): string {
  const raw = cleanEnv(process.env.R2_PUBLIC_URL) || cleanEnv(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
  if (!raw) throw new Error('R2_PUBLIC_URL not configured');
  return `${raw.replace(/\/$/, '')}/${key}`;
}

export function isR2Configured(): boolean {
  return !!(
    cleanEnv(process.env.R2_ENDPOINT) &&
    cleanEnv(process.env.R2_ACCESS_KEY_ID) &&
    cleanEnv(process.env.R2_SECRET_ACCESS_KEY) &&
    cleanEnv(process.env.R2_BUCKET_NAME)
  );
}

// ── Compression ──────────────────────────────────────────────────────────────

const VARIANTS = [
  { name: 'thumb',  maxWidth: 260,  targetBytes: 90  * 1024 },
  { name: 'medium', maxWidth: 520,  targetBytes: 150 * 1024 },
  { name: 'large',  maxWidth: 1080, targetBytes: 200 * 1024 },
] as const;

export async function compressWebpToTarget(
  input: Buffer,
  opts: { maxWidth: number; maxHeight: number; targetBytes?: number; minQuality?: number }
): Promise<Buffer> {
  const targetBytes  = opts.targetBytes  ?? 200 * 1024;
  const minQuality   = opts.minQuality   ?? 42;
  let quality = 76;
  let width   = opts.maxWidth;
  let height  = opts.maxHeight;
  let best: Buffer | null = null;

  for (let pass = 0; pass < 8; pass++) {
    let lq = quality;
    while (lq >= minQuality) {
      const out = await sharp(input)
        .rotate()
        .resize({ width, height, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: lq, effort: 5 })
        .toBuffer();
      best = out;
      if (out.length <= targetBytes) return out;
      lq -= 6;
    }
    width   = Math.max(420, Math.floor(width  * 0.86));
    height  = Math.max(220, Math.floor(height * 0.86));
    quality = Math.max(minQuality, quality - 4);
  }
  return best ?? input;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface R2UploadResult {
  /** URL principal (variante large) */
  url: string;
  /** Prefijo base sin sufijo para poder borrar las 3 variantes luego */
  key: string;
  variants: { thumb: string; medium: string; large: string };
}

export async function uploadImageToR2(
  buffer: Buffer,
  folder: string,
  filename: string,
): Promise<R2UploadResult> {
  const client   = getS3Client();
  const bucket   = cleanEnv(process.env.R2_BUCKET_NAME);
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '-').slice(0, 50);
  const ts       = Date.now();

  // Detect SVG files by extension or contents
  const isSvg = filename.toLowerCase().endsWith('.svg') || 
                (buffer.length >= 4 && buffer.slice(0, 100).toString('utf-8').trim().toLowerCase().includes('<svg'));

  if (isSvg) {
    const key = `govendy/${folder}/${ts}-${safeName}`;
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/svg+xml',
    }));
    const url = getPublicUrl(key);
    return {
      url,
      key,
      variants: { thumb: url, medium: url, large: url },
    };
  }

  const variants: Record<string, string> = {};

  for (const v of VARIANTS) {
    const processed = await compressWebpToTarget(buffer, {
      maxWidth: v.maxWidth, maxHeight: v.maxWidth, targetBytes: v.targetBytes,
    });
    const key = `govendy/${folder}/${ts}-${safeName}-${v.name}.webp`;
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: key, Body: processed, ContentType: 'image/webp',
    }));
    variants[v.name] = getPublicUrl(key);
  }

  return {
    url: variants.large,
    key: `govendy/${folder}/${ts}-${safeName}`,
    variants: { thumb: variants.thumb, medium: variants.medium, large: variants.large },
  };
}

// ── Delete ────────────────────────────────────────────────────────────────────

/** Borra claves directas (cualquier archivo en R2) */
export async function deleteR2Keys(keys: string[]): Promise<number> {
  const sanitized = [...new Set(keys.map(k => (k || '').trim()).filter(Boolean))];
  if (sanitized.length === 0) return 0;
  const client = getS3Client();
  const bucket = cleanEnv(process.env.R2_BUCKET_NAME);
  await client.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: sanitized.map(Key => ({ Key })) },
  }));
  return sanitized.length;
}

/**
 * Dado el base-key devuelto por uploadImageToR2 (sin sufijo), borra las 3 variantes WebP o el archivo original (SVG).
 * Ej. key = "govendy/products/1716777777-foto-jpg" 
 * → borra el archivo base directamente y las 3 variantes si existen.
 */
export async function deleteR2ImageVariants(baseKey: string): Promise<void> {
  const p = (baseKey || '').trim().replace(/\/$/, '');
  if (!p) return;
  try {
    // Para asegurar que borramos tanto el archivo original (si es SVG) como las 3 variantes comprimidas WebP
    await deleteR2Keys([p, `${p}-thumb.webp`, `${p}-medium.webp`, `${p}-large.webp`]);
  } catch (e) {
    console.warn('[R2] deleteR2ImageVariants failed:', e);
  }
}

/**
 * Extrae la clave del objeto R2 a partir de una URL pública.
 * Devuelve null si la URL no pertenece a este bucket.
 */
export function extractR2KeyFromUrl(fullUrl: string | null | undefined): string | null {
  const raw = (fullUrl || '').trim();
  if (!raw) return null;
  const baseRaw = cleanEnv(process.env.R2_PUBLIC_URL) || cleanEnv(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
  if (!baseRaw) return null;
  try {
    const u    = new URL(raw);
    const base = baseRaw.includes('://') ? baseRaw : `https://${baseRaw}`;
    const b    = new URL(base);
    if (u.hostname.toLowerCase() !== b.hostname.toLowerCase()) return null;
    return decodeURIComponent(u.pathname.replace(/^\//, '')).split('?')[0] || null;
  } catch { return null; }
}

/**
 * A partir de una URL de imagen (large) devuelve el base-key para poder
 * borrar las 3 variantes. Funciona solo para URLs subidas con uploadImageToR2.
 * Ej. "…/govendy/products/1716777777-foto-jpg-large.webp" → "govendy/products/1716777777-foto-jpg"
 */
export function r2UrlToBaseKey(url: string | null | undefined): string | null {
  const key = extractR2KeyFromUrl(url);
  if (!key) return null;
  // Quitar el sufijo -large.webp / -medium.webp / -thumb.webp
  return key.replace(/-(large|medium|thumb)\.webp$/, '') || null;
}

/** Elimina una carpeta completa de R2 (recursivo) */
export async function deleteR2Folder(folder: string): Promise<number> {
  const client = getS3Client();
  const bucket = cleanEnv(process.env.R2_BUCKET_NAME);
  const list   = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: folder }));
  const keys   = (list.Contents || []).map(o => o.Key!).filter(Boolean);
  if (keys.length === 0) return 0;
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map(Key => ({ Key })) } }));
  return keys.length;
}
