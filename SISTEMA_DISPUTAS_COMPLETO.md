# Sistema de Disputas - Documentación Completa

## 📋 Índice
1. [Resumen General](#resumen-general)
2. [Componentes Implementados](#componentes-implementados)
3. [Flujo de Disputas](#flujo-de-disputas)
4. [Archivos Modificados](#archivos-modificados)
5. [Configuración de Base de Datos](#configuración-de-base-de-datos)
6. [Troubleshooting](#troubleshooting)

---

## Resumen General

Se implementó un sistema completo de gestión de disputas que incluye:

- **Botón "Disputa" parpadeante en rojo** para comprador y vendedor
- **Contador de 72 horas en rojo** para resolver disputas entre las partes
- **Página de devoluciones** con información completa de las disputas
- **Panel de administrador** con resoluciones definitivas después de 72 horas
- **Integración en páginas de compras y ventas**

---

## Componentes Implementados

### 1. Botón "Disputa" Parpadeante

#### Ubicación
- **Página de Compras**: `app/dashboard/compras/page.tsx`
- **Página de Ventas**: `app/dashboard/ventas/page.tsx`

#### Características
- **Color**: Rojo (`bg-red-600` o `bg-red-500`)
- **Animación**: Parpadea (`animate-pulse`) cuando la disputa está abierta
- **Redirección**: Al hacer clic, redirige a `/dashboard/disputas/${disputeId}`
- **Visibilidad**: Solo aparece cuando existe una disputa asociada a la orden

#### Código Implementado

```typescript
{disputeId ? (() => {
  const disputeInfo = disputeInfoByOrderId[orderId];
  const isOpen = disputeInfo?.status === 'open';
  
  return (
    <div className="space-y-2">
      <Link
        href={`/dashboard/disputas/${disputeId}`}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 ${
          isOpen ? 'animate-pulse bg-red-600 ring-2 ring-red-400' : 'bg-red-500'
        }`}
      >
        Disputa
      </Link>
      {/* Contador de 72 horas aquí */}
    </div>
  );
})() : null}
```

### 2. Contador de 72 Horas en Rojo

#### Características
- **Color**: Siempre en rojo (`border-red-300 bg-red-50 text-red-900`)
- **Actualización**: Tiempo real cada segundo
- **Formato**: Muestra horas, minutos y segundos
- **Mensaje**: Indica que tienen 72 horas para resolver entre ellos

#### Código Implementado

```typescript
{isOpen && !expired ? (
  <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2">
    <div className="flex items-start gap-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div className="flex-1">
        <div className="text-xs font-extrabold text-red-900">
          Tiempo para resolver: {hoursRemaining}h {minutesRemaining}m {secondsRemaining}s
        </div>
        <div className="mt-0.5 text-[10px] text-red-800">
          Tienes 72 horas para resolver con el vendedor/comprador. Después, el administrador tomará una decisión.
        </div>
      </div>
    </div>
  </div>
) : isOpen && expired ? (
  <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2">
    <div className="text-xs font-extrabold text-gray-900">
      El administrador revisará tu caso
    </div>
    <div className="mt-0.5 text-[10px] text-gray-800">
      El tiempo para resolver ha expirado. El administrador tomará una decisión definitiva.
    </div>
  </div>
) : null}
```

#### Lógica del Contador

```typescript
const disputeCreatedAt = disputeInfo?.created_at ? new Date(disputeInfo.created_at).getTime() : 0;
const deadline = disputeCreatedAt + 72 * 60 * 60 * 1000; // 72 horas en milisegundos
const diff = deadline - currentTime.getTime();
const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
const secondsRemaining = Math.floor((diff % (1000 * 60)) / 1000);
const expired = diff <= 0;
```

### 3. Página de Devoluciones

#### Ubicación
- **Archivo**: `app/dashboard/devoluciones/page.tsx`

#### Características
- Muestra todas las disputas del usuario (comprador o vendedor)
- Información completa de cada disputa:
  - Estado de la disputa (Abierta, Resuelta, Cerrada)
  - Información de la orden (total, envío, rastreo)
  - Productos involucrados con imágenes
  - Participantes (comprador y vendedor)
  - Motivo de la disputa
  - Fecha de creación
- Enlace directo al chat de la disputa

#### Carga de Datos

```typescript
const load = async () => {
  // 1. Cargar disputas desde la API
  const res = await fetch(`/api/disputes/list?limit=200&t=${Date.now()}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const json = await res.json();
  const list = (json?.disputes ?? []) as any[];
  setDisputes(list);

  // 2. Cargar órdenes asociadas
  const orderIds = Array.from(new Set(list.map((d) => String(d?.order_id || '').trim()).filter(Boolean)));
  const { data: ordersData } = await supabase
    .from('orders')
    .select('*')
    .in('id', orderIds);

  // 3. Cargar items de las órdenes
  const { data: itemsData } = await supabase
    .from('order_items')
    .select('order_id,listing_id,title,quantity,unit_price,line_total')
    .in('order_id', orderIds);

  // 4. Cargar nombres de compradores y vendedores
  const userIds = Array.from(new Set(list.flatMap((d) => [String(d?.buyer_id || ''), String(d?.seller_id || '')])));
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id,full_name')
    .in('id', userIds);
};
```

### 4. Panel de Administrador

#### Ubicación
- **Archivo**: `app/admin/disputas/[disputeId]/page.tsx`

#### Características
- Muestra el contador de 72 horas
- Permite resoluciones definitivas después de 72 horas:
  - **Asignar guía de devolución**: El comprador debe devolver el producto, se reembolsa al recibirlo
  - **Mantener dinero al vendedor**: El vendedor mantiene el dinero por su trayectoria
- Opciones normales (antes de 72 horas):
  - Liberar pago al vendedor
  - Reembolsar al comprador
  - Cerrar disputa sin decisión

#### Código del Modal de Resolución

```typescript
{disputeCreatedAt && (Date.now() - new Date(disputeCreatedAt).getTime()) >= 72 * 60 * 60 * 1000 ? (
  <>
    <option value="assign_return_tracking">Asignar guía de devolución (reembolso después de recibir)</option>
    <option value="keep_money_seller">Mantener dinero al vendedor (por trayectoria)</option>
  </>
) : null}
```

### 5. API de Resolución de Disputas

#### Ubicación
- **Archivo**: `app/api/admin/disputes/resolve/route.ts`

#### Nuevas Decisiones

1. **`assign_return_tracking`**:
   - Requiere código de rastreo de devolución
   - Cambia el estado de la orden a `refunded`
   - El comprador debe devolver el producto
   - Se procesa el reembolso al recibir la devolución

2. **`keep_money_seller`**:
   - El vendedor mantiene el dinero
   - Cambia el estado de la orden a `paid`
   - Se envía notificación a ambas partes

#### Validación de 72 Horas

```typescript
const disputeCreatedAt = String((d as any)?.created_at || '').trim();
const canUseNewDecisions = disputeCreatedAt ? (Date.now() - new Date(disputeCreatedAt).getTime()) >= 72 * 60 * 60 * 1000 : false;

if ((decision === 'assign_return_tracking' || decision === 'keep_money_seller') && !canUseNewDecisions) {
  return NextResponse.json({ 
    error: 'Las resoluciones definitivas solo están disponibles después de 72 horas desde la apertura de la disputa.' 
  }, { status: 400 });
}
```

---

## Flujo de Disputas

### 1. Apertura de Disputa
1. El comprador abre una disputa desde la página de compras
2. Se crea un registro en la tabla `disputes`
3. Se envía notificación al vendedor
4. Aparece el botón "Disputa" parpadeante en rojo para ambas partes

### 2. Período de 72 Horas
1. Ambas partes ven el contador de 72 horas en rojo
2. Pueden comunicarse a través del chat de disputas
3. Intentan resolver el problema entre ellos

### 3. Después de 72 Horas
1. El contador desaparece
2. Se muestra mensaje: "El administrador revisará tu caso"
3. El administrador puede tomar una resolución definitiva:
   - Asignar guía de devolución
   - Mantener dinero al vendedor

### 4. Resolución
1. El administrador toma una decisión
2. Se actualiza el estado de la disputa
3. Se actualiza el estado de la orden
4. Se envían notificaciones a ambas partes

---

## Archivos Modificados

### Frontend

1. **`app/dashboard/compras/page.tsx`**
   - Agregado estado `disputeInfoByOrderId` para almacenar información completa de disputas
   - Modificada función `loadDisputes` para cargar `status` y `created_at`
   - Agregado botón "Disputa" parpadeante
   - Agregado contador de 72 horas en rojo
   - Agregados logs de depuración

2. **`app/dashboard/ventas/page.tsx`**
   - Agregado estado `disputeInfoByOrderId` para almacenar información completa de disputas
   - Modificada función `loadDisputes` para cargar `status` y `created_at`
   - Agregado botón "Disputa" parpadeante en dos ubicaciones:
     - En la sección de botones de acción
     - En el panel derecho (junto a Total, Comisión, Envío)
   - Agregado contador de 72 horas en rojo
   - Agregados logs de depuración

3. **`app/dashboard/devoluciones/page.tsx`**
   - Página completamente reescrita
   - Muestra todas las disputas con información completa
   - Carga órdenes, items, imágenes y nombres de usuarios
   - Agregados logs de depuración

4. **`app/admin/disputas/[disputeId]/page.tsx`**
   - Agregado estado `disputeCreatedAt` y `currentTime`
   - Agregado contador de 72 horas en el modal de resolución
   - Agregadas nuevas opciones de resolución después de 72 horas
   - Agregado campo para código de rastreo de devolución
   - Mejorado el manejo de carga (separación entre carga inicial y recargas periódicas)

### Backend

1. **`app/api/disputes/list/route.ts`**
   - Ya devuelve `created_at` y `status` (no se modificó, solo se agregaron logs)

2. **`app/api/admin/disputes/resolve/route.ts`**
   - Agregadas nuevas decisiones: `assign_return_tracking` y `keep_money_seller`
   - Agregada validación de 72 horas para resoluciones definitivas
   - Agregado manejo de código de rastreo de devolución
   - Mejorados mensajes de notificación

---

## Configuración de Base de Datos

### Tabla `disputes`

La tabla debe tener los siguientes campos:
- `id` (UUID, primary key)
- `order_id` (UUID, foreign key a orders)
- `buyer_id` (UUID, foreign key a profiles)
- `seller_id` (UUID, foreign key a profiles)
- `status` (text: 'open', 'resolved', 'closed')
- `created_at` (timestamptz)
- `admin_decision` (text, nullable)
- `admin_note` (text, nullable)

### Políticas RLS

Las políticas RLS deben permitir:
- **SELECT**: Usuarios pueden ver disputas donde son buyer_id o seller_id, o si son admin
- **INSERT**: Solo el comprador puede crear disputas
- **UPDATE**: Solo admin puede actualizar disputas
- **DELETE**: No se permite DELETE (las disputas se cierran, no se eliminan)

### Script SQL

El script `supabase_disputes.sql` debe estar ejecutado en Supabase. Si no está, ejecuta:

```sql
-- Verificar que existe la tabla
SELECT * FROM information_schema.tables WHERE table_name = 'disputes';

-- Si no existe, ejecutar supabase_disputes.sql
```

---

## Troubleshooting

### Problema: Error 400 al cargar perfiles (nickname/username no existen)

**Síntoma:**
```
Failed to load resource: the server responded with a status of 400
/profiles?select=id%2Cfull_name%2Cnickname%2Cusername
```

**Causa:**
- La tabla `profiles` no tiene las columnas `nickname` o `username`
- El código intenta cargar estos campos y falla con error 400

**Solución implementada:**
- Se mejoró el manejo de errores en `app/dashboard/ventas/page.tsx` y `app/dashboard/compras/page.tsx`
- Ahora captura errores 400 y códigos 42703 (columna no existe)
- Automáticamente hace fallback a solo `id,full_name` si hay error

**Código del fix:**
```typescript
let profRes: any = await supabase.from('profiles').select('id,full_name,nickname,username').in('id', buyerIds);
if (profRes.error) {
  const code = String((profRes.error as any)?.code || '');
  const msg = String((profRes.error as any)?.message || '').toLowerCase();
  // Intentar solo con full_name si hay error de columna o error 400
  if (code === '42703' || msg.includes('does not exist') || msg.includes('column') || code === '400') {
    profRes = await supabase.from('profiles').select('id,full_name').in('id', buyerIds);
  }
}
```

### Problema: No aparece el botón "Disputa"

**Causas posibles:**
1. No hay disputa asociada a la orden
2. Los datos no se están cargando correctamente
3. El `order_id` en la disputa no coincide con el ID de la orden

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca mensajes que empiecen con `[COMPRAS]` o `[VENTAS]`
3. Verifica los logs:
   - `Disputas cargadas`: Debe mostrar el número de disputas mapeadas
   - `Renderizando orden`: Debe mostrar si hay `disputeId` y `disputeInfo`

**Verificación en base de datos:**
```sql
-- Verificar disputas existentes
SELECT id, order_id, buyer_id, seller_id, status, created_at 
FROM disputes 
WHERE buyer_id = 'TU_USER_ID' OR seller_id = 'TU_USER_ID';

-- Verificar que el order_id coincide
SELECT o.id as order_id, d.id as dispute_id 
FROM orders o 
LEFT JOIN disputes d ON d.order_id = o.id 
WHERE o.buyer_id = 'TU_USER_ID' OR o.seller_id = 'TU_USER_ID';
```

### Problema: No aparece el contador de 72 horas

**Causas posibles:**
1. La disputa no está en estado 'open'
2. El `created_at` no se está cargando correctamente
3. El contador ya expiró

**Solución:**
1. Verifica en los logs que `disputeInfo` tenga `created_at`
2. Verifica que `isOpen` sea `true`
3. Verifica que `expired` sea `false`

**Verificación:**
```typescript
console.log('[DEBUG] Disputa info:', {
  disputeInfo,
  isOpen: disputeInfo?.status === 'open',
  created_at: disputeInfo?.created_at,
  currentTime: Date.now(),
  deadline: new Date(disputeInfo?.created_at).getTime() + 72 * 60 * 60 * 1000,
});
```

### Problema: No aparecen disputas en la página de devoluciones

**Causas posibles:**
1. La API no está devolviendo disputas
2. El filtro de `buyer_id`/`seller_id` no está funcionando
3. No hay disputas asociadas al usuario

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca mensajes que empiecen con `[DEVOLUCIONES]`
3. Verifica:
   - `Respuesta de la API`: Debe mostrar `ok: true` y `disputesCount > 0`
   - `Disputas recibidas`: Debe mostrar el array de disputas

**Verificación en base de datos:**
```sql
-- Verificar disputas del usuario actual
SELECT d.*, o.id as order_id_check
FROM disputes d
LEFT JOIN orders o ON o.id = d.order_id
WHERE d.buyer_id = 'TU_USER_ID' OR d.seller_id = 'TU_USER_ID';
```

**Verificación en la API:**
- Revisa los logs del servidor (terminal donde corre `npm run dev`)
- Busca mensajes que empiecen con `[API/DISPUTES/LIST]`
- Verifica que el `userId` sea correcto y que el filtro se esté aplicando

### Problema: El administrador no puede tomar resoluciones definitivas

**Causas posibles:**
1. No han pasado 72 horas desde la creación de la disputa
2. El `created_at` no se está cargando correctamente
3. Hay un error en el cálculo del tiempo

**Solución:**
1. Verifica en el modal de resolución que aparezca el mensaje: "✓ Puedes tomar una resolución definitiva"
2. Si no aparece, verifica los logs:
   ```typescript
   console.log('[ADMIN] Tiempo transcurrido:', {
     created_at: disputeCreatedAt,
     currentTime: Date.now(),
     diff: Date.now() - new Date(disputeCreatedAt).getTime(),
     hours: (Date.now() - new Date(disputeCreatedAt).getTime()) / (1000 * 60 * 60),
     canUse: (Date.now() - new Date(disputeCreatedAt).getTime()) >= 72 * 60 * 60 * 1000,
   });
   ```

### Problema: Los contadores no se actualizan en tiempo real

**Causa:**
- El `currentTime` no se está actualizando cada segundo

**Solución:**
- Verifica que exista este `useEffect`:
  ```typescript
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  ```

---

## Estructura de Datos

### Estado de Disputas en Frontend

```typescript
// Mapeo simple: orderId -> disputeId
const [disputeByOrderId, setDisputeByOrderId] = useState<Record<string, string>>({});

// Mapeo completo: orderId -> { id, status, created_at }
const [disputeInfoByOrderId, setDisputeInfoByOrderId] = useState<Record<string, { 
  id: string; 
  status: string; 
  created_at: string 
}>>({});
```

### Respuesta de la API `/api/disputes/list`

```json
{
  "ok": true,
  "viewer": {
    "user_id": "uuid-del-usuario",
    "is_admin": false
  },
  "disputes": [
    {
      "id": "uuid-de-disputa",
      "order_id": "uuid-de-orden",
      "buyer_id": "uuid-comprador",
      "seller_id": "uuid-vendedor",
      "status": "open",
      "created_at": "2026-01-22T03:48:00Z",
      "reason_code": "not_as_described",
      "reason_text": "Deseo una devolucion",
      "last_message": { ... }
    }
  ]
}
```

---

## Comandos Útiles para Verificación

### Verificar disputas en Supabase

```sql
-- Ver todas las disputas
SELECT 
  d.id,
  d.order_id,
  d.buyer_id,
  d.seller_id,
  d.status,
  d.created_at,
  d.admin_decision,
  o.status as order_status
FROM disputes d
LEFT JOIN orders o ON o.id = d.order_id
ORDER BY d.created_at DESC;

-- Ver disputas de un usuario específico
SELECT * FROM disputes 
WHERE buyer_id = 'USER_ID_AQUI' OR seller_id = 'USER_ID_AQUI';

-- Verificar que las disputas tienen created_at
SELECT id, order_id, status, created_at, 
       EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as horas_desde_creacion
FROM disputes
WHERE status = 'open';
```

### Verificar políticas RLS

```sql
-- Ver políticas de la tabla disputes
SELECT * FROM pg_policies WHERE tablename = 'disputes';

-- Verificar que existe la política de DELETE (si es necesaria)
SELECT * FROM pg_policies 
WHERE tablename = 'notifications' 
AND policyname LIKE '%delete%';
```

---

## Notas Importantes

1. **El contador siempre es rojo**: A diferencia del contador de 48 horas de pago (que cambia de color), el contador de 72 horas de disputas siempre es rojo para indicar urgencia.

2. **El botón parpadea solo cuando está abierto**: El botón "Disputa" solo parpadea cuando `status === 'open'`. Si la disputa está resuelta o cerrada, el botón es rojo sólido.

3. **El contador desaparece después de 72 horas**: Una vez que pasan 72 horas, el contador desaparece y se muestra un mensaje indicando que el administrador revisará el caso.

4. **Las resoluciones definitivas solo están disponibles después de 72 horas**: El administrador solo puede usar "Asignar guía de devolución" o "Mantener dinero al vendedor" después de que hayan pasado 72 horas.

5. **Los datos se cargan de forma asíncrona**: Las disputas se cargan después de las órdenes, por lo que puede haber un pequeño delay antes de que aparezcan los botones.

6. **Logs de depuración**: Se agregaron logs extensivos para facilitar el debugging. Busca en la consola mensajes que empiecen con `[COMPRAS]`, `[VENTAS]`, `[DEVOLUCIONES]`, o `[API/DISPUTES/LIST]`.

---

## Restauración Rápida

Si el sistema se desconfigura, sigue estos pasos:

1. **Verificar que la tabla `disputes` existe**:
   ```sql
   SELECT * FROM information_schema.tables WHERE table_name = 'disputes';
   ```

2. **Verificar políticas RLS**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'disputes';
   ```

3. **Verificar que los archivos estén correctos**:
   - `app/dashboard/compras/page.tsx`: Debe tener `disputeInfoByOrderId` y el botón "Disputa"
   - `app/dashboard/ventas/page.tsx`: Debe tener `disputeInfoByOrderId` y el botón "Disputa" en dos lugares
   - `app/dashboard/devoluciones/page.tsx`: Debe cargar y mostrar disputas
   - `app/admin/disputas/[disputeId]/page.tsx`: Debe tener el contador de 72 horas y las nuevas opciones

4. **Verificar la API**:
   - `app/api/disputes/list/route.ts`: Debe devolver `created_at` y `status`
   - `app/api/admin/disputes/resolve/route.ts`: Debe tener las nuevas decisiones

5. **Limpiar caché y recargar**:
   - Limpia el caché del navegador
   - Reinicia el servidor de desarrollo
   - Recarga la página

---

## Contacto y Soporte

Si necesitas ayuda adicional:
1. Revisa los logs en la consola del navegador
2. Revisa los logs del servidor (terminal)
3. Verifica la base de datos directamente en Supabase
4. Consulta este documento para entender el flujo completo

---

**Última actualización**: Enero 2026
**Versión**: 1.0
