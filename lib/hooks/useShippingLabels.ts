// Hook reutilizable para manejo de guías de envío

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface UseShippingLabelsResult {
  uploadLabel: (orderId: string, file: File) => Promise<string>;
  isUploading: boolean;
  error: string | null;
  success: string | null;
}

export function useShippingLabels(): UseShippingLabelsResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const uploadedLabelUrlRef = useRef<Record<string, string>>({});

  const uploadLabel = async (orderId: string, file: File): Promise<string> => {
    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      // Validaciones
      if (!file || file.size === 0 || file.size > 15 * 1024 * 1024) {
        throw new Error('Archivo inválido (máx 15MB)');
      }

      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('file', file);

      const res = await fetch('/api/admin/logistica/label/upload-v2', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || 'Error al subir la guía');
      }

      // Guardar URL en ref para verificación posterior
      uploadedLabelUrlRef.current[orderId] = json.url;

      setSuccess('Guía subida exitosamente');
      return json.url;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      setError(errorMsg);
      throw e;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadLabel,
    isUploading,
    error,
    success,
  };
}
