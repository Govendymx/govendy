// Servicio para manejo de archivos en storage

import { supabaseAdmin } from '@/lib/supabase/admin';
import { sanitizeFileName } from '@/lib/utils/validation';

export interface UploadFileParams {
  file: File;
  bucket: string;
  folder: string;
  fileName?: string;
}

export interface UploadResult {
  url: string;
  path: string;
}

export class StorageService {
  /**
   * Subir archivo a storage
   */
  async uploadFile(params: UploadFileParams): Promise<UploadResult> {
    const { file, bucket, folder, fileName } = params;

    // Validaciones
    if (!file || file.size === 0) {
      throw new Error('El archivo está vacío');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error('El archivo es demasiado grande (máx 15MB)');
    }

    const admin = supabaseAdmin();

    // Asegurar que el bucket existe
    const bucketExists = await admin.storage.getBucket(bucket).catch(() => null);
    if (!bucketExists?.data) {
      await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
    }

    // Preparar path
    const safeName = fileName || sanitizeFileName(file.name || 'file');
    const path = `${folder}/${Date.now()}-${safeName}`;

    // Convertir a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir archivo
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });

    if (uploadError) {
      throw new Error(`Error subiendo archivo: ${uploadError.message}`);
    }

    // Obtener URL pública
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
    const url = urlData.publicUrl;

    if (!url) {
      throw new Error('No se pudo obtener URL pública del archivo');
    }

    return { url, path };
  }

  /**
   * Subir guía de envío (PDF)
   */
  async uploadShippingLabel(orderId: string, file: File): Promise<UploadResult> {
    return this.uploadFile({
      file,
      bucket: 'upload',
      folder: `labels/${orderId}`,
      fileName: sanitizeFileName(file.name || 'guia.pdf'),
    });
  }
}
