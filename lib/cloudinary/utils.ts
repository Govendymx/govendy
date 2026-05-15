import cloudinary from './config';

export interface UploadOptions {
  folder?: string;
  watermark?: string; // Nombre de la imagen de marca de agua en Cloudinary
}

/**
 * Sube una imagen a Cloudinary y aplica marca de agua automáticamente
 */
export async function uploadImageWithWatermark(
  file: File | string,
  options: UploadOptions = {}
): Promise<string> {
  const { folder = 'products', watermark } = options;

  try {
    const missing: string[] = [];
    if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
    if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
    if (missing.length > 0) {
      throw new Error(`Faltan variables de Cloudinary: ${missing.join(', ')} (revisa tu .env.local)`);
    }

    let uploadResult;

    // Si es un archivo (File object), convertir a base64
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const dataURI = `data:${file.type};base64,${base64}`;

      const uploadOptions: any = {
        folder,
        resource_type: 'image',
      };

      // Si hay marca de agua, aplicarla como overlay
      if (watermark) {
        uploadOptions.overlay = watermark;
        uploadOptions.flags = 'relative';
        uploadOptions.width = 0.3; // 30% del tamaño de la imagen
        uploadOptions.opacity = 70; // 70% de opacidad
        uploadOptions.gravity = 'south_east'; // Esquina inferior derecha
      }

      uploadResult = await cloudinary.uploader.upload(dataURI, uploadOptions);
    } else {
      // Si es una URL o path
      const uploadOptions: any = {
        folder,
        resource_type: 'image',
      };

      if (watermark) {
        uploadOptions.overlay = watermark;
        uploadOptions.flags = 'relative';
        uploadOptions.width = 0.3;
        uploadOptions.opacity = 70;
        uploadOptions.gravity = 'south_east';
      }

      uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
    }

    return uploadResult.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to upload image to Cloudinary',
    );
  }
}

/**
 * Sube múltiples imágenes (hasta 6) para un producto
 */
export async function uploadProductImages(
  files: File[],
  productId: string,
  watermark?: string
): Promise<string[]> {
  if (files.length > 6) {
    throw new Error('Maximum 6 images per product allowed');
  }

  const uploadPromises = files.map((file, index) =>
    uploadImageWithWatermark(file, {
      folder: `products/${productId}`,
      watermark,
    })
  );

  return Promise.all(uploadPromises);
}

/**
 * Genera URL optimizada de Cloudinary con marca de agua
 */
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
    watermark?: string;
  } = {}
): string {
  const {
    width,
    height,
    quality = 80,
    format = 'auto',
    watermark,
  } = options;

  let transformations = '';

  if (width || height) {
    transformations += `w_${width || 'auto'},h_${height || 'auto'},c_fill/`;
  }

  if (format) {
    transformations += `f_${format},q_${quality}/`;
  }

  if (watermark) {
    transformations += `l_${watermark},w_0.3,o_70,g_south_east/`;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}${publicId}`;
}

/**
 * Elimina una imagen de Cloudinary
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw new Error('Failed to delete image from Cloudinary');
  }
}