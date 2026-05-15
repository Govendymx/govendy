# Integración de Guías de Envío - Documentación Completa

## 📋 Índice
1. [Resumen General](#resumen-general)
2. [Estructura de Base de Datos](#estructura-de-base-de-datos)
3. [Flujo Completo de la Guía](#flujo-completo-de-la-guía)
4. [APIs Involucradas](#apis-involucradas)
5. [Interfaces de Usuario](#interfaces-de-usuario)
6. [Notificaciones y Realtime](#notificaciones-y-realtime)
7. [Configuración](#configuración)

---

## Resumen General

El sistema de guías de envío permite a los administradores subir PDFs de guías de paquetería que luego los vendedores pueden descargar desde su panel de ventas. El sistema rastrea:

- **Subida de guía**: Por el administrador en `/admin/logistica`
- **Descarga de guía**: Por el vendedor en `/dashboard/ventas`
- **Estado de descarga**: Si el vendedor ya descargó la guía
- **Notificaciones**: Alerta al vendedor cuando la guía está disponible

---

## Estructura de Base de Datos

### Tabla `orders` - Columnas de Logística

El script `supabase_orders_logistics.sql` agrega las siguientes columnas a la tabla `orders`:

```sql
-- URL pública del PDF de la guía
shipping_label_url TEXT

-- Cuándo se subió la guía
shipping_label_uploaded_at TIMESTAMP WITH TIME ZONE

-- Quién subió la guía (UUID del admin)
shipping_label_uploaded_by UUID

-- Cuándo el vendedor descargó la guía (solo se marca una vez)
label_downloaded_at TIMESTAMP WITH TIME ZONE

-- Número de rastreo
tracking_number TEXT

-- Cuándo se marcó como enviado
shipped_at TIMESTAMP WITH TIME ZONE

-- Cuándo se entregó
delivered_at TIMESTAMP WITH TIME ZONE

-- Paquetería (DHL, FedEx, Estafeta, etc.)
shipping_carrier TEXT
```

### Índice para Performance

```sql
CREATE INDEX orders_seller_status_created_idx
  ON public.orders (seller_id, status, created_at DESC);
```

Este índice optimiza las consultas de ventas del vendedor.

---

## Flujo Completo de la Guía

### 1. Administrador Sube la Guía

**Ubicación**: `/admin/logistica`

**Proceso**:
1. El administrador ve la lista de órdenes en la página de logística
2. Para cada orden, hay un botón "Upload guía"
3. Al hacer clic, se abre un selector de archivos (solo PDF)
4. El administrador selecciona el PDF de la guía
5. Se sube a Supabase Storage

**Código Frontend** (`app/admin/logistica/page.tsx`):
```typescript
const uploadLabel = async (orderId: string, file: File) => {
  const fd = new FormData();
  fd.append('orderId', orderId);
  fd.append('file', file);
  
  const res = await fetch('/api/admin/logistica/label/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });
  
  // Recargar lista después de subir
  await load();
};
```

### 2. API Procesa la Subida

**Endpoint**: `/api/admin/logistica/label/upload`

**Proceso**:
1. **Validación**: Verifica que el usuario sea admin
2. **Validación de archivo**: Máximo 15MB, debe ser PDF
3. **Verificación de orden**: Confirma que la orden existe
4. **Subida a Storage**:
   - Bucket: `upload`
   - Carpeta: `labels/{orderId}/{timestamp}-{filename}.pdf`
   - Ejemplo: `labels/abc123/1705123456789-guia.pdf`
5. **Obtención de URL pública**: Se genera la URL pública del PDF
6. **Actualización de orden**: Se guarda en `orders.shipping_label_url`
7. **Notificación al vendedor**: Se crea una notificación tipo `shipping_label_ready`
8. **Broadcast realtime**: Se notifica a otros admins en la página de logística

**Código Backend** (`app/api/admin/logistica/label/upload/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  // 1. Verificar admin
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  
  // 2. Obtener archivo y orderId
  const form = await req.formData();
  const orderId = String(form.get('orderId') || '').trim();
  const file = form.get('file') as File | null;
  
  // 3. Validaciones
  if (!orderId || !file) return NextResponse.json({ error: 'Datos faltantes' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'PDF demasiado grande' }, { status: 400 });
  
  // 4. Verificar orden
  const { data: orderRow } = await admin
    .from('orders')
    .select('id,seller_id')
    .eq('id', orderId)
    .maybeSingle();
  
  // 5. Subir a Storage
  const bucket = 'upload';
  const path = `labels/${orderId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const up = await admin.storage.from(bucket).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  
  // 6. Obtener URL pública
  const pub = admin.storage.from(bucket).getPublicUrl(path);
  const url = pub.data.publicUrl;
  
  // 7. Actualizar orden
  await admin.from('orders').update({
    shipping_label_url: url,
    shipping_label_uploaded_at: new Date().toISOString(),
    shipping_label_uploaded_by: requesterId,
  }).eq('id', orderId);
  
  // 8. Notificar al vendedor
  await admin.from('notifications').insert([{
    user_id: sellerId,
    type: 'shipping_label_ready',
    title: 'Guía disponible',
    body: `Ya puedes descargar la guía de envío para tu venta (orden ${orderId.slice(0, 8)}…).`,
    data: { orderId },
    is_read: false,
  }]);
  
  // 9. Broadcast realtime
  void broadcastAdminLogistica(orderId, { kind: 'label_uploaded', shipping_label_url: url });
  
  return NextResponse.json({ ok: true, url });
}
```

### 3. Vendedor Ve la Notificación

**Ubicación**: `/dashboard/notificaciones` y contador en `AccountTopMenu`

**Proceso**:
- El vendedor recibe una notificación tipo `shipping_label_ready`
- El contador de notificaciones se actualiza automáticamente
- Puede hacer clic para ir a sus ventas

### 4. Vendedor Descarga la Guía

**Ubicación**: `/dashboard/ventas`

**Proceso**:
1. El vendedor ve sus ventas en el dashboard
2. Para órdenes con guía disponible, aparece un botón "Descargar guía"
3. Al hacer clic:
   - Se abre el PDF en una nueva pestaña
   - Se marca `label_downloaded_at` en la base de datos (solo una vez)
   - Se actualiza el estado visual (de "Guía lista" a "Guía descargada")
   - Se notifica a los admins en tiempo real

**Código Frontend** (`app/dashboard/ventas/page.tsx`):
```typescript
const downloadLabel = async (orderId: string, labelUrl: string) => {
  // Abrir PDF en nueva pestaña
  window.open(labelUrl, '_blank');
  
  // Marcar como descargada localmente (optimistic update)
  const now = new Date().toISOString();
  setLabelDownloadedAtByOrderId((prev) => ({ ...prev, [orderId]: now }));
  
  // Notificar al backend
  try {
    await fetch('/api/orders/label-downloaded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch (err) {
    console.error('Error al marcar guía como descargada:', err);
  }
};
```

### 5. API Registra la Descarga

**Endpoint**: `/api/orders/label-downloaded`

**Proceso**:
1. **Validación**: Verifica que el usuario sea el vendedor de la orden
2. **Verificación**: Confirma que la guía existe (`shipping_label_url` no está vacío)
3. **Actualización**: Marca `label_downloaded_at` (solo si aún no está marcado)
4. **Broadcast realtime**: Notifica a los admins en la página de logística

**Código Backend** (`app/api/orders/label-downloaded/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  // 1. Obtener token y orderId
  const token = getBearerToken(req);
  const body = await req.json();
  const orderId = String(body?.orderId || '').trim();
  
  // 2. Verificar usuario
  const { data: userData } = await supabase.auth.getUser(token);
  
  // 3. Verificar orden y permisos
  const { data: row } = await admin
    .from('orders')
    .select('id,seller_id,shipping_label_url,label_downloaded_at')
    .eq('id', orderId)
    .maybeSingle();
  
  // 4. Verificar que es el vendedor
  if (String(row.seller_id) !== userData.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  
  // 5. Verificar que la guía existe
  if (!String(row.shipping_label_url || '').trim()) {
    return NextResponse.json({ error: 'La guía aún no está disponible' }, { status: 400 });
  }
  
  // 6. Marcar como descargada (solo si no está marcada)
  await admin.from('orders').update({
    label_downloaded_at: row.label_downloaded_at ?? new Date().toISOString()
  }).eq('id', orderId);
  
  // 7. Broadcast realtime
  void broadcastAdminLogistica(orderId, { kind: 'label_downloaded' });
  
  return NextResponse.json({ ok: true });
}
```

---

## APIs Involucradas

### 1. `/api/admin/logistica/label/upload` (POST)

**Propósito**: Subir PDF de guía de envío

**Autenticación**: Requiere ser admin

**Request**:
- `FormData` con:
  - `orderId`: UUID de la orden
  - `file`: Archivo PDF (máx 15MB)

**Response**:
```json
{
  "ok": true,
  "url": "https://supabase.co/storage/v1/object/public/upload/labels/abc123/1705123456789-guia.pdf"
}
```

**Errores**:
- `400`: Datos faltantes, PDF demasiado grande, orden no encontrada
- `401`: No autenticado
- `403`: No es admin
- `500`: Error al subir o procesar

### 2. `/api/orders/label-downloaded` (POST)

**Propósito**: Registrar que el vendedor descargó la guía

**Autenticación**: Requiere ser el vendedor de la orden

**Request**:
```json
{
  "orderId": "uuid-de-la-orden"
}
```

**Response**:
```json
{
  "ok": true
}
```

**Errores**:
- `400`: orderId faltante, guía no disponible
- `401`: No autenticado
- `403`: No es el vendedor de la orden
- `404`: Orden no encontrada

### 3. `/api/admin/logistica/orders/list` (GET)

**Propósito**: Listar órdenes para la página de logística

**Autenticación**: Requiere ser admin

**Query Parameters**:
- `limit`: Número máximo de órdenes (default: 80)

**Response**:
```json
{
  "ok": true,
  "orders": [
    {
      "id": "uuid",
      "status": "paid",
      "shipping_label_url": "https://...",
      "shipping_label_uploaded_at": "2026-01-22T...",
      "label_downloaded_at": "2026-01-22T...",
      "tracking_number": "ABC123",
      "shipping_carrier": "DHL",
      ...
    }
  ],
  "itemsByOrder": { ... },
  "nameById": { ... },
  "addressById": { ... }
}
```

---

## Interfaces de Usuario

### 1. Página de Logística (Admin)

**Ruta**: `/admin/logistica`

**Características**:
- Tabla con todas las órdenes
- Columna "Guía (PDF)": Muestra botón "Ver guía" si existe, o "Guía pendiente"
- Columna "Upload": Botón para subir guía
- Estados visuales:
  - **Guía pendiente**: Botón "Upload guía" (rosa)
  - **Guía subida, no descargada**: Badge "En espera" (amarillo) + botón "Reemplazar guía"
  - **Guía descargada**: Badge "Descargada" (verde) + botón "Re-subir guía"
- Información mostrada:
  - Fecha de subida
  - Fecha de descarga (si aplica)
  - Quién subió la guía

**Código relevante**:
```typescript
{labelUrl ? (
  <div className="space-y-2">
    <a href={labelUrl} target="_blank" rel="noreferrer">
      Ver guía
    </a>
    <div>Subida: {fmt(o?.shipping_label_uploaded_at)}</div>
    <div>
      Descargada por vendedor: {fmt(o?.label_downloaded_at)}
    </div>
  </div>
) : (
  <div>Guía pendiente</div>
)}
```

### 2. Página de Ventas (Vendedor)

**Ruta**: `/dashboard/ventas`

**Características**:
- Lista de ventas del vendedor
- Para cada orden con guía disponible:
  - Botón "Descargar guía" (si no se ha descargado)
  - Badge "Guía descargada" (si ya se descargó)
  - Fecha de descarga
  - Contador de 72 horas desde la descarga (para enviar)

**Código relevante**:
```typescript
{labelUrl ? (
  <div className="space-y-2">
    {isLabelDownloaded ? (
      <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
        <div className="text-xs font-extrabold text-green-800">
          Guía descargada
        </div>
        <div className="text-[11px] text-green-800/80">
          Descargada: {formatDateTime(labelDownloadedAt)}
        </div>
        <Countdown72Hours 
          startTime={labelDownloadedAt || null} 
          shippedAt={shippedAt || null} 
        />
      </div>
    ) : (
      <button
        onClick={() => downloadLabel(orderId, labelUrl)}
        className="rounded-xl bg-brand-pink px-3 py-2 text-xs font-semibold text-white"
      >
        Descargar guía
      </button>
    )}
  </div>
) : (
  <div className="text-xs text-gray-500">
    Guía pendiente
  </div>
)}
```

---

## Notificaciones y Realtime

### 1. Notificación al Vendedor

**Tipo**: `shipping_label_ready`

**Cuándo se crea**: Cuando el admin sube la guía

**Contenido**:
```typescript
{
  user_id: sellerId,
  type: 'shipping_label_ready',
  title: 'Guía disponible',
  body: `Ya puedes descargar la guía de envío para tu venta (orden ${orderId.slice(0, 8)}…).`,
  data: { orderId },
  is_read: false,
}
```

**Dónde se muestra**:
- Contador de notificaciones en `AccountTopMenu`
- Página de notificaciones (`/dashboard/notificaciones`)

### 2. Realtime Updates

**Canal**: `admin-logistica`

**Eventos**:
- `label_uploaded`: Cuando se sube una guía
- `label_downloaded`: Cuando el vendedor descarga la guía

**Implementación**:
```typescript
// En app/admin/logistica/page.tsx
useEffect(() => {
  const ch = supabase
    .channel('admin-logistica')
    .on('broadcast', { event: 'order_updated' }, () => {
      scheduleReload(); // Recargar lista después de 400ms
    })
    .subscribe();
  
  return () => {
    supabase.removeChannel(ch);
  };
}, []);
```

**Función de broadcast**:
```typescript
async function broadcastAdminLogistica(orderId: string, payload: any = {}) {
  const admin = supabaseAdmin();
  const ch = admin.channel('admin-logistica');
  await ch.subscribe();
  await ch.send({ 
    type: 'broadcast', 
    event: 'order_updated', 
    payload: { orderId, ...payload, t: Date.now() } 
  });
  admin.removeChannel(ch);
}
```

**Throttling**: Se usa `scheduleReload()` con debounce de 400ms y throttle de 1200ms para evitar recargas excesivas.

---

## Configuración

### 1. Ejecutar Script SQL

**Archivo**: `supabase_orders_logistics.sql`

**Qué hace**:
- Agrega columnas de logística a la tabla `orders`
- Crea índice para optimizar consultas

**Cómo ejecutar**:
1. Ir a Supabase Dashboard
2. SQL Editor
3. Pegar el contenido del archivo
4. Ejecutar

**Verificación**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN (
  'shipping_label_url',
  'shipping_label_uploaded_at',
  'label_downloaded_at',
  'tracking_number'
);
```

### 2. Configurar Storage Bucket

**Bucket**: `upload`

**Configuración**:
- **Público**: Sí (para que las URLs sean accesibles)
- **Políticas RLS**: 
  - Lectura pública para archivos en `labels/*`
  - Escritura solo para admins (vía `supabaseAdmin()`)

**Creación automática**: El código crea el bucket si no existe:
```typescript
const bucket = 'upload';
const exists = await admin.storage.getBucket(bucket).catch(() => null);
if (!exists?.data) {
  await admin.storage.createBucket(bucket, { public: true }).catch(() => null);
}
```

### 3. Variables de Entorno

No se requieren variables adicionales. El sistema usa:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (para operaciones admin)

---

## Flujo Visual Completo

```
┌─────────────────┐
│   ADMIN         │
│ /admin/logistica│
└────────┬────────┘
         │
         │ 1. Sube PDF
         ▼
┌─────────────────────────┐
│  API: label/upload      │
│  - Valida admin          │
│  - Sube a Storage        │
│  - Actualiza orders     │
│  - Crea notificación    │
└────────┬────────────────┘
         │
         │ 2. Notifica
         ▼
┌─────────────────────────┐
│  Notificación creada     │
│  Tipo: shipping_label_   │
│  _ready                  │
└────────┬────────────────┘
         │
         │ 3. Vendedor ve notificación
         ▼
┌─────────────────┐
│   VENDEDOR      │
│ /dashboard/     │
│ ventas          │
└────────┬────────┘
         │
         │ 4. Descarga guía
         ▼
┌─────────────────────────┐
│  API: label-downloaded  │
│  - Valida vendedor      │
│  - Marca descargada     │
│  - Broadcast realtime   │
└────────┬────────────────┘
         │
         │ 5. Admin ve actualización
         ▼
┌─────────────────┐
│   ADMIN         │
│ /admin/logistica│
│ (actualizado)   │
└─────────────────┘
```

---

## Estados de la Guía

### Estado 1: Sin Guía
- `shipping_label_url`: `NULL`
- `shipping_label_uploaded_at`: `NULL`
- **UI Admin**: Botón "Upload guía"
- **UI Vendedor**: "Guía pendiente"

### Estado 2: Guía Subida, No Descargada
- `shipping_label_url`: `"https://..."`
- `shipping_label_uploaded_at`: `"2026-01-22T..."`
- `label_downloaded_at`: `NULL`
- **UI Admin**: Badge "En espera" (amarillo) + "Reemplazar guía"
- **UI Vendedor**: Botón "Descargar guía"

### Estado 3: Guía Descargada
- `shipping_label_url`: `"https://..."`
- `shipping_label_uploaded_at`: `"2026-01-22T..."`
- `label_downloaded_at`: `"2026-01-22T..."`
- **UI Admin**: Badge "Descargada" (verde) + "Re-subir guía"
- **UI Vendedor**: Badge "Guía descargada" + contador de 72 horas

---

## Mejores Prácticas

### 1. Validación de Archivos
- Solo aceptar PDFs
- Límite de tamaño: 15MB
- Sanitizar nombres de archivo

### 2. Seguridad
- Solo admins pueden subir guías
- Solo el vendedor puede marcar como descargada
- URLs públicas pero con nombres únicos (timestamp + orderId)

### 3. Performance
- Usar índices en base de datos
- Throttling en realtime updates
- Optimistic updates en frontend

### 4. UX
- Feedback inmediato al subir/descargar
- Estados visuales claros
- Notificaciones automáticas

---

## Troubleshooting

### Problema: La guía no se sube

**Causas posibles**:
1. El usuario no es admin
2. El archivo es demasiado grande (>15MB)
3. El bucket `upload` no existe o no es público
4. Faltan columnas en la tabla `orders`

**Solución**:
1. Verificar que el usuario esté en `admin_users`
2. Reducir tamaño del PDF
3. Verificar bucket en Supabase Storage
4. Ejecutar `supabase_orders_logistics.sql`

### Problema: El vendedor no puede descargar

**Causas posibles**:
1. No es el vendedor de la orden
2. La guía aún no está disponible
3. Error al abrir el PDF

**Solución**:
1. Verificar `orders.seller_id` coincide con el usuario
2. Verificar que `shipping_label_url` no sea NULL
3. Verificar que la URL sea accesible públicamente

### Problema: No aparecen actualizaciones en tiempo real

**Causas posibles**:
1. Realtime no está habilitado en Supabase
2. RLS bloquea las actualizaciones
3. El canal no se está suscribiendo correctamente

**Solución**:
1. Habilitar Realtime en Supabase Dashboard
2. Verificar políticas RLS para `orders`
3. Revisar logs de la consola del navegador

---

## Comandos Útiles

### Verificar guías en base de datos

```sql
-- Ver todas las órdenes con guía
SELECT 
  id,
  status,
  shipping_label_url,
  shipping_label_uploaded_at,
  label_downloaded_at,
  seller_id
FROM orders
WHERE shipping_label_url IS NOT NULL
ORDER BY shipping_label_uploaded_at DESC;

-- Ver guías no descargadas
SELECT id, shipping_label_url, shipping_label_uploaded_at
FROM orders
WHERE shipping_label_url IS NOT NULL
  AND label_downloaded_at IS NULL
ORDER BY shipping_label_uploaded_at DESC;
```

### Verificar Storage

```sql
-- Listar archivos en el bucket (requiere acceso admin)
-- Esto se hace desde Supabase Dashboard → Storage → upload → labels
```

---

**Última actualización**: Enero 2026  
**Versión**: 1.0
