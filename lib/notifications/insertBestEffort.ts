export type NotificationPayload = {
  user_id: string;
  type?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null; // compat si tu tabla usa "message" en vez de "body"
  link_to?: string | null; // ruta de la app (ej. /dashboard/ventas?order=…)
  data?: any;
  is_read?: boolean;
  created_at?: string;
};

export type InsertNotificationResult =
  | { ok: true }
  | { ok: false; code?: string; message?: string };

const ENUM_FALLBACK_TYPES = [
  // Ordenado por probabilidad de existir según nuestros scripts
  'admin_announcement',
  'listing_question',
  'listing_answer', // Respuesta a pregunta
  'new_sale',
  'sale_paid',
  'payment_approved',
  'payment_rejected',
  'order_completed',
  'support_message',
  'support_reply',
  'bid_received',
  'auction_ended',
  'cart_reminder',
  'shipped',
  'rating_received',
  'dispute_opened',
  'dispute_message',
  'test',
] as const;

function isColumnOrSchemaCacheError(code: string, msg: string) {
  const low = msg.toLowerCase();
  return code === '42703' || code === 'PGRST204' || low.includes('column') || low.includes('schema cache');
}

function sanitizeForMissingColumns(payload: any, msg: string) {
  const low = msg.toLowerCase();
  const p: any = { ...payload };

  // PostgREST suele incluir el nombre de columna en el mensaje.
  if (low.includes('data')) delete p.data;
  if (low.includes('is_read')) delete p.is_read;
  if (low.includes('created_at')) delete p.created_at;
  if (low.includes('title')) delete p.title;
  if (low.includes('link_to')) delete p.link_to;

  // Compat body/message
  if (low.includes('body')) {
    if ('body' in p) {
      // si no existe body, intentamos message; si ambos fallan, lo quitamos
      if (!('message' in p)) p.message = p.body;
      delete p.body;
    }
  }
  if (low.includes('message')) {
    if ('message' in p) {
      if (!('body' in p)) p.body = p.message;
      delete p.message;
    }
  }

  return p;
}

// Inserta notificación sin romper si el schema varía (best-effort + fallbacks).
export async function insertNotificationBestEffort(admin: any, payload: NotificationPayload): Promise<InsertNotificationResult> {
  // Si el caller manda un `type`, también lo guardamos en data.kind para compatibilidad
  // (por ejemplo cuando `type` es un ENUM y no acepta strings custom).
  const base: any = { ...payload };
  // Siempre marcar nuevas notificaciones como is_read: false explícitamente
  if (!('is_read' in base)) base.is_read = false;
  const t = typeof base.type === 'string' ? base.type.trim() : '';
  if (t) {
    const d = (base.data && typeof base.data === 'object') ? { ...base.data } : {};
    if (!('kind' in d)) d.kind = t;
    base.data = d;
  }

  console.log('[NOTIFICATIONS] Intentando crear notificación:', {
    user_id: base.user_id,
    type: base.type,
    title: base.title,
    body: base.body,
    hasData: !!base.data,
  });

  let ins: any = await admin.from('notifications').insert([base]);
  if (!ins?.error) {
    console.log('[NOTIFICATIONS] ✅ Notificación creada exitosamente');
    return { ok: true };
  }

  console.error('[NOTIFICATIONS] ❌ Error al crear notificación:', {
    code: (ins.error as any)?.code,
    message: (ins.error as any)?.message,
    fullError: ins.error,
  });

  const code = String((ins.error as any)?.code || '');
  const msg = String((ins.error as any)?.message || '').toLowerCase();

  // Tabla no existe / schema cache / endpoint no encontrado
  if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist') || msg.includes('schema cache') || code === 'PGRST106') {
    return { ok: false, code, message: String((ins.error as any)?.message || '') };
  }

  // ENUM inválido (ej: notification_type) → reintentar sin `type` para que use DEFAULT del enum
  if (code === '22P02' && msg.includes('invalid input value for enum')) {
    const fEnum: any = { ...base };
    delete fEnum.type;
    ins = await admin.from('notifications').insert([fEnum]);
    if (!ins?.error) return { ok: true };

    // Si el schema tiene `type` NOT NULL sin DEFAULT, el insert sin type falla con 23502.
    const code2 = String((ins.error as any)?.code || '');
    const msg2 = String((ins.error as any)?.message || '').toLowerCase();

    // Si el fallo es por columnas faltantes, intentamos degradar el payload (sin type) antes de rendirnos.
    if (isColumnOrSchemaCacheError(code2, msg2)) {
      const fEnum2 = sanitizeForMissingColumns(fEnum, msg2);
      ins = await admin.from('notifications').insert([fEnum2]);
      if (!ins?.error) return { ok: true };
    }

    if (code2 === '23502' && msg2.includes('null') && msg2.includes('type')) {
      for (const fallbackType of ENUM_FALLBACK_TYPES) {
        let f2: any = { ...base, type: fallbackType };
        ins = await admin.from('notifications').insert([f2]);
        if (!ins?.error) return { ok: true };

        const c3 = String((ins.error as any)?.code || '');
        const m3 = String((ins.error as any)?.message || '').toLowerCase();

        // Columnas faltantes con ENUM: degradar y reintentar con este fallbackType
        if (isColumnOrSchemaCacheError(c3, m3)) {
          f2 = sanitizeForMissingColumns(f2, m3);
          ins = await admin.from('notifications').insert([f2]);
          if (!ins?.error) return { ok: true };
          const c4 = String((ins.error as any)?.code || '');
          const m4 = String((ins.error as any)?.message || '').toLowerCase();
          // si sigue siendo enum inválido, probamos el siguiente
          if (c4 === '22P02' && m4.includes('invalid input value for enum')) continue;
          // si sigue siendo columnas faltantes, probamos el siguiente fallbackType (quizá otra combinación)
          if (isColumnOrSchemaCacheError(c4, m4)) continue;
          // error distinto: no seguir spameando inserts
          break;
        }

        // si sigue siendo enum inválido, probamos el siguiente
        if (c3 === '22P02' && m3.includes('invalid input value for enum')) continue;
        // error distinto: no seguir spameando inserts
        break;
      }
    }

    return { ok: false, code: code2, message: String((ins.error as any)?.message || '') };
  }

  // Columnas faltantes → degradar
  if (isColumnOrSchemaCacheError(code, msg)) {
    // Intento 1: degradar según mensaje
    let f1: any = sanitizeForMissingColumns(base, msg);
    ins = await admin.from('notifications').insert([f1]);
    if (!ins?.error) return { ok: true };

    // Intento 2: degradación agresiva (por si el mensaje no menciona todas las columnas)
    const code2 = String((ins.error as any)?.code || '');
    const msg2 = String((ins.error as any)?.message || '').toLowerCase();
    if (isColumnOrSchemaCacheError(code2, msg2)) {
      const f2: any = { ...f1 };
      delete f2.data;
      delete f2.is_read;
      delete f2.created_at;
      delete f2.title;
      delete f2.link_to;
      // último recurso: body/message
      if ('body' in f2) {
        f2.message = f2.body;
        delete f2.body;
      }
      ins = await admin.from('notifications').insert([f2]);
      if (!ins?.error) return { ok: true };
      return { ok: false, code: String((ins.error as any)?.code || ''), message: String((ins.error as any)?.message || '') };
    }

    return { ok: false, code: code2, message: String((ins.error as any)?.message || '') };
  }

  return { ok: false, code, message: String((ins.error as any)?.message || '') };
}

