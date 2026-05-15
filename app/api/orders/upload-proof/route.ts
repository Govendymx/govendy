import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: Request) {
  try {
    console.log('[upload-proof] START');
    const { effectiveUserId } = await requireAuth(req as any);
    console.log('[upload-proof] Auth OK, userId:', effectiveUserId);
    const formData = await req.formData();
    const orderId = formData.get('orderId') as string;
    const files = formData.getAll('file');
    const uploadType = formData.get('type') as string | null; // 'constancia' | 'ine' | null
    const providedUrl = (formData.get('url') as string | null)?.trim() || null;

    console.log('[upload-proof] orderId:', orderId, 'files:', files.length, 'type:', uploadType, 'providedUrl:', !!providedUrl);

    if (!orderId || (!providedUrl && (!files || files.length === 0))) {
      console.log('[upload-proof] MISSING DATA');
      return NextResponse.json({ error: 'Faltan datos (orderId o file)' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, seller_id, status, shipping_option_id, shipping_carrier, tracking_number, shipping_by_seller')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.log('[upload-proof] ORDER NOT FOUND:', orderError?.message);
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (order.seller_id !== effectiveUserId) {
      console.log('[upload-proof] PERMISSION DENIED. seller:', order.seller_id, 'user:', effectiveUserId);
      return NextResponse.json({ error: 'No tienes permiso para modificar esta orden' }, { status: 403 });
    }
    console.log('[upload-proof] Order OK');

    const bucketName = 'delivery-proofs';

    // Verificar si existe el bucket, si no, crearlo (solo una vez)
    // Nota: Esto podría optimizarse verificando error en upload, pero por seguridad lo dejamos
    const { data: buckets } = await admin.storage.listBuckets();
    const bucketExists = buckets?.find(b => b.name === bucketName);

    if (!bucketExists) {
      await admin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: null
      });
    } else {
      // Quitar restricciones de MIME para permitir cualquier archivo
      await admin.storage.updateBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800,
        allowedMimeTypes: null
      });
    }

    const uploadedUrls: string[] = [];
    let detectedTracking: { code: string; carrier: string | null } | null = null;

    const parseAscii = (buf: Buffer) => {
      const a = buf.toString('utf8');
      if (a && /[A-Za-z0-9]/.test(a)) return a;
      return buf.toString('latin1');
    };
    const contextScan = (text: string) => {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const markers = /(c[oó]digo\s+de\s+rastreo|rastreo|tracking|gu[ií]a|n[uú]mero\s+de\s+gu[ií]a)/i;
      for (let i = 0; i < lines.length; i++) {
        if (markers.test(lines[i])) {
          const windowLines = [lines[i], lines[i + 1] || '', lines[i + 2] || ''].join(' ');
          const candidates = windowLines.match(/\b[A-Z0-9-]{8,22}\b/g) || [];
          for (const c of candidates) {
            if (/^\d{10}$/.test(c)) return { code: c, carrier: 'Estafeta' };
            if (/^1Z[A-Z0-9]{16}$/.test(c)) return { code: c, carrier: 'UPS' };
          }
          if (candidates[0]) return { code: candidates[0], carrier: null };
        }
      }
      return null;
    };
    const detectFromText = (text: string) => {
      // Primero: contexto cerca de "Código de Rastreo" o "Guía"
      const ctx = contextScan(text);
      if (ctx) return ctx;
      // Fallback: patrones generales
      const patterns: Array<{ carrier: string | null; re: RegExp }> = [
        { carrier: 'UPS', re: /\b1Z[A-Z0-9]{16}\b/ },
        { carrier: 'DHL', re: /\bJD\d{18}\b/ },
        { carrier: 'DHL', re: /\b3S[A-Z0-9]{8,20}\b/ },
        { carrier: 'FedEx', re: /\b(\d{20}|\d{15}|\d{12})\b/ },
        // Estafeta típico: 10 dígitos
        { carrier: 'Estafeta', re: /\b\d{10}\b/ },
      ];
      for (const p of patterns) {
        const m = text.match(p.re);
        if (m && m[0]) return { code: m[0].trim(), carrier: p.carrier };
      }
      return null;
    };
    const detectFromName = (name: string) => {
      return detectFromText(name.replace(/[_\-]+/g, ' '));
    };
    const extractPdfText = async (buf: Buffer): Promise<string | null> => {
      try {
        const mod = await import('pdf-parse');
        const pdfParse = (mod as any)?.default || (mod as any);
        const res = await pdfParse(buf);
        if (res?.text && typeof res.text === 'string') return res.text;
        return null;
      } catch {
        return null;
      }
    };
    const ocrImage = async (buf: Buffer): Promise<string | null> => {
      try {
        const mod = await import('tesseract.js');
        const Tesseract = (mod as any)?.default || (mod as any);
        const result = await Tesseract.recognize(buf, 'eng', {
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz:-/ ',
        });
        const text = result?.data?.text;
        if (text && typeof text === 'string') return text;
        return null;
      } catch {
        return null;
      }
    };

    // Para uploads de tipo constancia/ine o cuando ya viene la URL, saltar detección de tracking
    const skipTracking = uploadType === 'constancia' || uploadType === 'ine' || Boolean(providedUrl);

    if (providedUrl) {
      uploadedUrls.push(providedUrl);
    } else {
      for (const fileItem of files) {
        const file = fileItem as File;
        if (!file || !file.name) continue;

        const fileExt = file.name.split('.').pop();
        // Generar nombre único: orderId_timestamp_random.ext
        const fileName = `${orderId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await admin.storage
          .from(bucketName)
          .upload(filePath, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading proof:', uploadError);
          return NextResponse.json({ error: `Error al subir el archivo ${file.name}: ${uploadError.message}` }, { status: 500 });
        }

        const { data: { publicUrl } } = admin.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);

        if (!skipTracking && !detectedTracking) {
          const nameGuess = detectFromName(file.name || '');
          if (nameGuess) detectedTracking = nameGuess;
          if (!detectedTracking) {
            let textSample: string | null = null;
            const isPdf = (file.type && file.type.includes('pdf')) || String(fileExt).toLowerCase() === 'pdf';
            const isImage = (file.type && file.type.startsWith('image/')) || /^(png|jpe?g|webp|gif)$/i.test(String(fileExt || ''));
            if (isPdf) {
              textSample = await extractPdfText(buffer);
            } else if (isImage) {
              textSample = await ocrImage(buffer);
            } else {
              const ascii = parseAscii(buffer);
              textSample = ascii.slice(0, 80000);
            }
            if (textSample) {
              const guess = detectFromText(textSample);
              if (guess) detectedTracking = guess;
            }
          }
        }
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'No se pudieron subir los archivos' }, { status: 500 });
    }

    const finalUrl = uploadedUrls.join(',');

    console.log('Proofs uploaded:', finalUrl);

    // Actualizar orden
    const updatePayload: any = {};
    // Si viene con type (constancia/ine), agregar la URL a la existente en vez de reemplazar
    if (uploadType && (uploadType === 'constancia' || uploadType === 'ine')) {
      const { data: existing } = await admin
        .from('orders')
        .select('delivery_proof_url')
        .eq('id', orderId)
        .single();
      const existingUrl = String(existing?.delivery_proof_url || '').trim();
      if (existingUrl) {
        updatePayload.delivery_proof_url = `${existingUrl},${finalUrl}`;
      } else {
        updatePayload.delivery_proof_url = finalUrl;
      }
    } else {
      updatePayload.delivery_proof_url = finalUrl;
    }

    const isPickup = order.shipping_option_id === 'pickup' || (order as any).shipping_carrier === 'pickup';
    const isSellerManaged = Boolean((order as any).shipping_by_seller);
    // Para uploads parciales (constancia o ine), verificar si con este upload ya están ambas evidencias
    const isPartialUpload = uploadType === 'constancia' || uploadType === 'ine';
    if (isPickup && !isPartialUpload) {
      updatePayload.status = 'delivered';
      updatePayload.delivered_at = new Date().toISOString();
      updatePayload.shipped_at = new Date().toISOString();
      if (!order.shipping_carrier) updatePayload.shipping_carrier = 'pickup';
      if (!order.tracking_number) updatePayload.tracking_number = 'ENTREGA_PERSONAL';
    }
    // Si es upload parcial (constancia/ine) y la URL ya tiene coma (ambas subidas), marcar como delivered
    if (isPickup && isPartialUpload) {
      const combinedUrl = updatePayload.delivery_proof_url || '';
      const urlCount = combinedUrl.split(',').filter((u: string) => u.trim()).length;
      if (urlCount >= 2) {
        updatePayload.status = 'delivered';
        updatePayload.delivered_at = new Date().toISOString();
        updatePayload.shipped_at = new Date().toISOString();
        if (!order.shipping_carrier) updatePayload.shipping_carrier = 'pickup';
        if (!order.tracking_number) updatePayload.tracking_number = 'ENTREGA_PERSONAL';
      }
    }
    // Seller-managed shipping: when seller uploads the guide, mark as shipped
    // so the buyer can confirm receipt and rate
    if (!isPickup && isSellerManaged && !isPartialUpload && order.status === 'paid') {
      updatePayload.status = 'shipped';
      updatePayload.shipped_at = new Date().toISOString();
      // Set a tracking placeholder if none detected, so buyer-side checks pass
      if (!order.tracking_number && !detectedTracking) {
        updatePayload.tracking_number = 'ENVIO_VENDEDOR';
      }
    }
    if (!isPickup && detectedTracking && detectedTracking.code) {
      if (!order.tracking_number) updatePayload.tracking_number = detectedTracking.code;
      if (!order.shipping_carrier && detectedTracking.carrier) updatePayload.shipping_carrier = detectedTracking.carrier;
    }

    // Usar admin para actualizar la orden y evitar bloqueos por RLS
    const { error: updateError } = await admin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json({ error: 'Error al actualizar la orden en base de datos' }, { status: 500 });
    }

    return NextResponse.json({ url: finalUrl, status: isPickup ? 'delivered' : 'shipped', detected_tracking: detectedTracking });
  } catch (error: any) {
    console.error('[upload-proof] CAUGHT ERROR:', error?.message || error, error?.stack);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
