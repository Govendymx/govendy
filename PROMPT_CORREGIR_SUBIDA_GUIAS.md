# Prompt: Corregir Subida de Guías que Desaparece

## 🐛 Problema Reportado

Al hacer click en "Upload guía" en el panel de logística (`/admin/logistica`):
1. La guía se sube correctamente por unos segundos
2. Aparece el estado "En espera" o "Ver guía"
3. Después de unos segundos, vuelve a aparecer el botón "Upload guía"
4. La guía parece desaparecer y no persiste

## 🔍 Análisis del Problema

### Código Actual

**Frontend** (`app/admin/logistica/page.tsx`):
```typescript
const uploadLabel = async (orderId: string, file: File) => {
  setIsUploading(true);
  try {
    // ... validaciones ...
    
    const res = await fetch('/api/admin/logistica/label/upload', { 
      method: 'POST', 
      headers: { authorization: `Bearer ${token}` }, 
      body: fd 
    });
    
    const json = await res.json();
    
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || 'No se pudo subir la guía.');
    }
    
    // Optimistic update
    setRows((prev) => 
      prev.map((o) => {
        if (String(o?.id || '') === orderId) {
          return {
            ...o,
            shipping_label_url: json.url,
            shipping_label_uploaded_at: new Date().toISOString(),
            label_downloaded_at: null,
          };
        }
        return o;
      })
    );
    
    // Recargar después de 800ms
    setTimeout(() => {
      void load(true);
    }, 800);
  } catch (e) {
    setError(e instanceof Error ? e.message : 'No se pudo subir la guía.');
  } finally {
    setIsUploading(false);
  }
};
```

**Backend** (`app/api/admin/logistica/label/upload/route.ts`):
```typescript
// Actualiza la orden en BD
const upd = await admin
  .from('orders')
  .update({
    shipping_label_url: url,
    shipping_label_uploaded_at: new Date().toISOString(),
    shipping_label_uploaded_by: requesterId,
  })
  .eq('id', orderId);
```

### Posibles Causas

1. **El `load()` está trayendo datos antiguos** (caché del navegador o de la API)
2. **La actualización en BD no se está guardando correctamente** (error silencioso)
3. **El `scheduleReload()` está interfiriendo** y recargando con datos antiguos
4. **El estado local se está sobrescribiendo** antes de que la BD se actualice
5. **Falta la columna `shipping_label_url` en la query de `load()`**
6. **El Realtime está disparando recargas con datos antiguos**

---

## ✅ Soluciones a Implementar

### 1. Verificar que la Actualización en BD Funciona

**Verificar en el backend que la actualización se guarda:**

```typescript
// En /api/admin/logistica/label/upload/route.ts
const upd: any = await admin
  .from('orders')
  .update({
    shipping_label_url: url,
    shipping_label_uploaded_at: new Date().toISOString(),
    shipping_label_uploaded_by: requesterId,
  })
  .eq('id', orderId)
  .select('id,shipping_label_url,shipping_label_uploaded_at'); // CRÍTICO: Seleccionar para verificar

if (upd.error) {
  console.error('[API LABEL UPLOAD] Error actualizando orden:', upd.error);
  return NextResponse.json({ error: upd.error.message }, { status: 400 });
}

// CRÍTICO: Verificar que realmente se actualizó
if (!upd.data || upd.data.length === 0) {
  console.error('[API LABEL UPLOAD] ⚠️ ADVERTENCIA: La actualización no afectó ninguna fila');
  return NextResponse.json({ error: 'No se pudo actualizar la orden. Verifica que existe.' }, { status: 404 });
}

const updatedOrder = upd.data[0];
console.log('[API LABEL UPLOAD] ✅ Orden actualizada en BD:', {
  orderId,
  shipping_label_url: updatedOrder.shipping_label_url,
  shipping_label_uploaded_at: updatedOrder.shipping_label_uploaded_at,
});

// CRÍTICO: Verificar que la URL se guardó correctamente
if (String(updatedOrder.shipping_label_url || '').trim() !== url) {
  console.error('[API LABEL UPLOAD] ⚠️ ERROR: La URL guardada no coincide con la subida');
  return NextResponse.json({ error: 'Error: La URL no se guardó correctamente.' }, { status: 500 });
}
```

### 2. Verificar que `load()` Incluye `shipping_label_url`

**Verificar en `/api/admin/logistica/orders/list/route.ts`:**

```typescript
// Asegurar que shipping_label_url está en el SELECT
const fullSelect =
  'id,buyer_id,seller_id,status,payment_method,subtotal,shipping_fee,commission_fee,total,created_at,paid_at,shipping_full_name,shipping_phone,shipping_address,shipping_label_url,shipping_label_uploaded_at,shipping_label_uploaded_by,label_downloaded_at,tracking_number,shipped_at,delivered_at,shipping_carrier';
```

**Verificar que la respuesta incluye el campo:**

```typescript
// Agregar logging para verificar
console.log('[logistica/orders/list] Órdenes obtenidas:', {
  total: orders.length,
  sampleOrder: orders[0] ? {
    id: orders[0].id,
    hasShippingLabelUrl: !!orders[0].shipping_label_url,
    shipping_label_url: orders[0].shipping_label_url,
  } : null,
});
```

### 3. Mejorar el Manejo de Estado en Frontend

**Problema:** El `setTimeout` con `load()` puede estar trayendo datos antiguos si hay caché.

**Solución:** Mejorar el optimistic update y verificar antes de recargar:

```typescript
const uploadLabel = async (orderId: string, file: File) => {
  setError(null);
  setIsUploading(true);
  
  // CRÍTICO: Guardar el estado anterior para rollback si falla
  const previousRows = rows;
  
  try {
    console.log('[LOGISTICA] Iniciando subida de guía:', { orderId, fileName: file.name, fileSize: file.size });
    
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      window.location.href = '/login?returnTo=/admin/logistica';
      return;
    }
    
    // Validar archivo
    if (!file || file.size === 0 || file.size > 15 * 1024 * 1024) {
      throw new Error('Archivo inválido.');
    }
    
    const fd = new FormData();
    fd.append('orderId', orderId);
    fd.append('file', file);
    
    const res = await fetch('/api/admin/logistica/label/upload', { 
      method: 'POST', 
      headers: { authorization: `Bearer ${token}` }, 
      body: fd 
    });
    
    const json = await res.json().catch(() => ({ error: 'Error en la respuesta del servidor' }));
    
    if (!res.ok || !json?.ok || !json?.url) {
      const errorMsg = json?.error || `No se pudo subir la guía (${res.status}).`;
      console.error('[LOGISTICA] Error del servidor:', { status: res.status, error: errorMsg, json });
      throw new Error(errorMsg);
    }
    
    console.log('[LOGISTICA] ✅ Guía subida exitosamente:', { url: json.url, orderId });
    
    // CRÍTICO: Actualizar estado local con los datos del servidor
    setRows((prev) => 
      prev.map((o) => {
        const oid = String(o?.id || '');
        if (oid === orderId) {
          console.log('[LOGISTICA] Actualizando orden localmente:', oid, { url: json.url });
          return {
            ...o,
            shipping_label_url: json.url, // Usar la URL del servidor
            shipping_label_uploaded_at: new Date().toISOString(),
            shipping_label_uploaded_by: requesterId, // Si está disponible
            label_downloaded_at: null, // Resetear descarga al re-subir
          };
        }
        return o;
      })
    );
    
    // CRÍTICO: Limpiar el input file para permitir re-subir el mismo archivo
    const fileInput = document.getElementById(`label_${orderId}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
      console.log('[LOGISTICA] Input file limpiado');
    }
    
    // CRÍTICO: Recargar desde BD después de un delay más largo para asegurar que se guardó
    // Pero solo si el optimistic update no tiene la URL
    setTimeout(async () => {
      console.log('[LOGISTICA] Verificando que la guía se guardó en BD...');
      
      // Verificar primero si el estado local tiene la URL
      const currentOrder = rows.find((o) => String(o?.id || '') === orderId);
      if (currentOrder?.shipping_label_url === json.url) {
        console.log('[LOGISTICA] La URL ya está en el estado local, recargando para sincronizar...');
        await load(true);
      } else {
        console.warn('[LOGISTICA] ⚠️ La URL no está en el estado local, forzando recarga...');
        await load(true);
      }
    }, 1500); // Aumentar delay a 1.5 segundos para dar tiempo a que se guarde en BD
    
  } catch (e: unknown) {
    console.error('[LOGISTICA] Error en uploadLabel:', e);
    setError(e instanceof Error ? e.message : 'No se pudo subir la guía.');
    
    // CRÍTICO: Rollback del estado si falla
    setRows(previousRows);
  } finally {
    setIsUploading(false);
  }
};
```

### 4. Prevenir Recargas Interferentes

**Problema:** El `scheduleReload()` puede estar recargando con datos antiguos.

**Solución:** Agregar un flag para prevenir recargas durante la subida:

```typescript
const [isUploading, setIsUploading] = useState(false);
const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null); // NUEVO

const scheduleReload = () => {
  // CRÍTICO: No recargar si hay una subida en progreso
  if (isUploading || uploadingOrderId) {
    console.log('[LOGISTICA] Ignorando recarga: subida en progreso');
    return;
  }
  
  const now = Date.now();
  if (now - lastReloadAtRef.current < 1200) return;
  if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  reloadTimerRef.current = setTimeout(() => {
    lastReloadAtRef.current = Date.now();
    void load();
  }, 400);
};

const uploadLabel = async (orderId: string, file: File) => {
  setError(null);
  setIsUploading(true);
  setUploadingOrderId(orderId); // NUEVO: Marcar que esta orden está siendo subida
  
  try {
    // ... código de subida ...
    
    // Después de subir exitosamente, esperar un poco antes de permitir recargas
    setTimeout(() => {
      setUploadingOrderId(null);
    }, 2000);
    
  } catch (e) {
    setUploadingOrderId(null);
    // ... manejo de errores ...
  } finally {
    setIsUploading(false);
  }
};
```

### 5. Agregar Verificación en el Backend

**Agregar verificación después de actualizar:**

```typescript
// En /api/admin/logistica/label/upload/route.ts
// Después de actualizar, verificar que se guardó correctamente
const verifyRes: any = await admin
  .from('orders')
  .select('id,shipping_label_url,shipping_label_uploaded_at')
  .eq('id', orderId)
  .maybeSingle();

if (verifyRes.error) {
  console.error('[API LABEL UPLOAD] Error verificando actualización:', verifyRes.error);
  return NextResponse.json({ error: 'La guía se subió pero no se pudo verificar.' }, { status: 500 });
}

if (!verifyRes.data || String(verifyRes.data.shipping_label_url || '').trim() !== url) {
  console.error('[API LABEL UPLOAD] ⚠️ ERROR CRÍTICO: La URL no se guardó correctamente', {
    expected: url,
    actual: verifyRes.data?.shipping_label_url,
  });
  return NextResponse.json({ error: 'Error: La URL no se guardó correctamente en la base de datos.' }, { status: 500 });
}

console.log('[API LABEL UPLOAD] ✅ Verificación exitosa:', {
  orderId,
  shipping_label_url: verifyRes.data.shipping_label_url,
  shipping_label_uploaded_at: verifyRes.data.shipping_label_uploaded_at,
});
```

### 6. Mejorar el Manejo del Input File

**Problema:** El input file puede no limpiarse correctamente.

**Solución:** Limpiar el input después de subir exitosamente:

```typescript
// En el onChange del input file
onChange={(e) => {
  const f = e.target.files?.[0];
  if (!f) {
    console.log('[LOGISTICA] No se seleccionó archivo');
    return;
  }
  console.log('[LOGISTICA] Archivo seleccionado para orden:', oid, { fileName: f.name, size: f.size });
  
  // Subir la guía
  void uploadLabel(oid, f).then(() => {
    // CRÍTICO: Limpiar el input después de subir exitosamente
    e.target.value = '';
    console.log('[LOGISTICA] Input file limpiado después de subir');
  }).catch((err) => {
    console.error('[LOGISTICA] Error al subir, manteniendo input:', err);
    // No limpiar si falla, para que el usuario pueda intentar de nuevo
  });
}}
```

---

## 🔧 Checklist de Implementación

- [ ] **Backend: Verificar que la actualización se guarda correctamente**
  - [ ] Agregar `.select()` después del `.update()` para verificar
  - [ ] Agregar logging detallado
  - [ ] Agregar verificación después de actualizar
  - [ ] Retornar error si la actualización no afectó ninguna fila

- [ ] **Backend: Verificar que la query de `load()` incluye `shipping_label_url`**
  - [ ] Verificar que `fullSelect` incluye todas las columnas de logística
  - [ ] Agregar logging para verificar que la respuesta incluye el campo

- [ ] **Frontend: Mejorar el optimistic update**
  - [ ] Usar la URL del servidor en lugar de generar una local
  - [ ] Guardar estado anterior para rollback si falla
  - [ ] Limpiar el input file después de subir exitosamente

- [ ] **Frontend: Prevenir recargas interferentes**
  - [ ] Agregar flag `uploadingOrderId` para prevenir recargas durante subida
  - [ ] Modificar `scheduleReload()` para ignorar recargas durante subida
  - [ ] Aumentar delay antes de recargar (1.5 segundos)

- [ ] **Frontend: Mejorar manejo de errores**
  - [ ] Rollback del estado si falla
  - [ ] Mostrar mensaje de error claro
  - [ ] No limpiar input si falla

- [ ] **Testing: Verificar que funciona**
  - [ ] Subir una guía y verificar que persiste
  - [ ] Refrescar la página y verificar que la guía sigue ahí
  - [ ] Verificar en la BD que `shipping_label_url` se guardó correctamente
  - [ ] Verificar que el vendedor recibe la notificación

---

## 🐛 Debugging

### Si la guía sigue desapareciendo:

1. **Verificar en la consola del navegador:**
   - Buscar logs `[LOGISTICA]` y `[API LABEL UPLOAD]`
   - Verificar que la subida fue exitosa
   - Verificar que la actualización en BD fue exitosa
   - Verificar que el `load()` trae la URL correcta

2. **Verificar en la base de datos:**
   ```sql
   SELECT id, shipping_label_url, shipping_label_uploaded_at, shipping_label_uploaded_by
   FROM orders
   WHERE id = 'ORDER_ID_AQUI'
   ORDER BY created_at DESC;
   ```
   
   Si `shipping_label_url` es NULL o diferente, el problema está en el backend.

3. **Verificar en Network tab:**
   - Verificar que `/api/admin/logistica/label/upload` retorna `{ ok: true, url: "..." }`
   - Verificar que `/api/admin/logistica/orders/list` incluye `shipping_label_url` en la respuesta

4. **Verificar que no hay caché:**
   - Agregar `?t=${Date.now()}` a las queries
   - Verificar headers `Cache-Control: no-store`

---

## 📝 Notas Adicionales

- El problema puede ser causado por múltiples factores trabajando juntos
- Es importante verificar tanto el backend como el frontend
- El logging detallado es crucial para identificar dónde falla
- El optimistic update debe usar los datos del servidor, no generar datos locales
- Las recargas automáticas pueden interferir con las actualizaciones manuales

---

## 🚀 Siguiente Paso

Una vez implementadas las correcciones:
1. Probar subiendo una guía
2. Verificar que persiste después de refrescar
3. Verificar que el vendedor recibe la notificación
4. Verificar en la BD que los datos se guardaron correctamente
