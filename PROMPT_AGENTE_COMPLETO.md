# Prompt Completo para Agente de IA - Pocket Marketplace

## 🎯 Propósito de este Documento

Este documento es un **prompt completo** que debes usar cuando trabajes con la aplicación Pocket Marketplace. Contiene toda la información necesaria para entender la arquitectura, conexiones, funcionalidades y resolver problemas.

---

## 📋 Contexto General

**Pocket Marketplace** es una plataforma de comercio C2C (consumidor a consumidor) similar a Mercado Libre, construida con:

- **Next.js 14.2.0** (App Router)
- **TypeScript 5.3.3**
- **Supabase** (PostgreSQL + Auth + Storage)
- **Cloudinary** (imágenes con marca de agua)
- **MercadoPago** (pagos online)
- **Tailwind CSS 3.4.1** (tema rosa Liverpool)

---

## 🏗️ Arquitectura General

### Flujo de Datos

```
Usuario (Browser)
    ↓
Next.js Frontend (React Components)
    ↓
API Routes (/app/api/*)
    ↓
Supabase Client (lib/supabase/*)
    ↓
Supabase Database/Storage/Auth
```

### Estructura del Proyecto

```
Pocket-App/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (Backend)
│   │   ├── admin/         # Endpoints de administración
│   │   ├── chat/          # Chat de órdenes
│   │   ├── disputes/      # Sistema de disputas
│   │   ├── notifications/ # Notificaciones
│   │   ├── orders/        # Gestión de órdenes
│   │   ├── listings/      # Productos/publicaciones
│   │   └── ...
│   ├── dashboard/         # Panel de usuario
│   │   ├── compras/       # Compras del usuario
│   │   ├── ventas/        # Ventas del usuario
│   │   ├── devoluciones/  # Disputas del usuario
│   │   ├── notificaciones/ # Notificaciones
│   │   └── ...
│   ├── admin/             # Panel de administración
│   │   ├── disputas/      # Gestión de disputas
│   │   ├── logistica/     # Gestión de envíos
│   │   ├── metricas/      # Analytics
│   │   └── ...
│   ├── listings/          # Páginas de productos
│   └── page.tsx           # Página principal
├── components/            # Componentes React reutilizables
│   ├── AccountTopMenu.tsx # Menú superior con notificaciones
│   ├── OrderChatFloating.tsx # Chat flotante
│   └── ...
├── lib/                   # Utilidades y configuraciones
│   ├── supabase/         # Clientes de Supabase
│   │   ├── client.ts     # Cliente frontend (cliente-side)
│   │   ├── server.ts     # Cliente server-side
│   │   └── admin.ts      # Cliente admin (bypass RLS)
│   ├── cloudinary/       # Utilidades de Cloudinary
│   └── ...
├── public/                # Archivos estáticos
└── supabase_*.sql        # Scripts SQL de migración
```

---

## 🔌 Conexiones y Configuración

### 1. Cliente Supabase (Frontend)

**Archivo**: `lib/supabase/client.ts`

**Variables de Entorno**:
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima (pública, segura)

**Uso**:
```typescript
import { supabase } from '@/lib/supabase/client';

// En componentes React (cliente-side)
const { data, error } = await supabase.from('listings').select('*');
```

**Características**:
- Persistencia de sesión en `localStorage`
- Auto-refresh de tokens
- PKCE flow para seguridad
- Validación robusta de variables de entorno

### 2. Cliente Supabase Admin (Backend)

**Archivo**: `lib/supabase/admin.ts`

**Variables de Entorno**:
- `SUPABASE_URL`: URL del proyecto
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio (NUNCA exponer al cliente)

**Uso**:
```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';

// En API routes (server-side)
const admin = supabaseAdmin();
const { data } = await admin.from('notifications').delete().eq('id', id);
```

**⚠️ IMPORTANTE**: 
- Solo usar en API routes (server-side)
- NUNCA en componentes React
- Bypass RLS para operaciones privilegiadas

### 3. Cliente Supabase Server

**Archivo**: `lib/supabase/server.ts`

**Uso**: Para Server Components de Next.js

---

## 🔐 Autenticación y Autorización

### Flujo de Autenticación

1. **Inicio de Sesión**:
   - Email/Password: `supabase.auth.signInWithPassword()`
   - OAuth (Google/Facebook): `supabase.auth.signInWithOAuth()`

2. **Verificación de Sesión**:
   ```typescript
   const { data, error } = await supabase.auth.getUser();
   if (!data.user) {
     window.location.href = '/?auth=1';
   }
   ```

3. **Token Bearer en APIs**:
   ```typescript
   // Frontend envía token
   const { data: { session } } = await supabase.auth.getSession();
   const token = session?.access_token;
   
   // API recibe token
   const authHeader = req.headers.get('authorization');
   const token = authHeader?.replace('Bearer ', '');
   ```

### Verificación de Admin

**Patrón común en APIs**:
```typescript
async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }
  
  const supabase = createClient(url, anonKey);
  const { data: userData } = await supabase.auth.getUser(token);
  
  const admin = supabaseAdmin();
  const { data: adminRow } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  
  if (!adminRow) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  return { userId: userData.user.id, admin };
}
```

### Row Level Security (RLS)

Supabase usa RLS para controlar acceso a nivel de fila:

- **Políticas SELECT**: Usuarios solo ven sus propios datos
- **Políticas INSERT**: Solo pueden crear registros propios
- **Políticas UPDATE**: Solo pueden actualizar sus propios registros
- **Políticas DELETE**: Solo pueden eliminar sus propios registros

**Bypass RLS**: Usar `supabaseAdmin()` cuando se necesite acceso sin restricciones (solo server-side).

---

## 🗄️ Base de Datos - Tablas Principales

### `profiles`
- **Propósito**: Información de usuarios
- **Campos clave**: `id`, `full_name`, `ine_front_url`, `ine_back_url`, `address_street`, `reputation_score`
- **RLS**: Usuarios solo ven/editan su propio perfil

### `listings`
- **Propósito**: Productos/publicaciones
- **Campos clave**: `id`, `seller_id`, `title`, `price`, `images`, `status`, `public_id`, `sale_type`
- **RLS**: Vendedores solo ven/editan sus propias publicaciones

### `orders`
- **Propósito**: Órdenes de compra
- **Campos clave**: `id`, `buyer_id`, `seller_id`, `status`, `total`, `shipping_cost`, `shipping_label_url`, `tracking_number`
- **RLS**: Compradores y vendedores ven sus órdenes relacionadas

### `disputes`
- **Propósito**: Disputas/devoluciones
- **Campos clave**: `id`, `order_id`, `buyer_id`, `seller_id`, `status`, `created_at`
- **RLS**: Compradores y vendedores ven disputas donde participan

### `notifications`
- **Propósito**: Notificaciones del sistema
- **Campos clave**: `id`, `user_id`, `type`, `title`, `body`, `read_at`
- **RLS**: Usuarios solo ven sus propias notificaciones

### `checkout_sessions`
- **Propósito**: Sesiones de pago offline
- **Campos clave**: `id`, `order_id`, `status`, `paid_confirmed_by_name`, `created_at`

### Relaciones Clave

```
profiles (1) ──< (N) listings (seller_id)
listings (1) ──< (N) order_items (listing_id)
orders (1) ──< (N) order_items (order_id)
orders (1) ──< (1) disputes (order_id)
orders (1) ──< (1) checkout_sessions (order_id)
```

---

## 🔄 APIs Principales

### Estructura de API Routes

Todas las APIs están en `app/api/*/route.ts` y siguen este patrón:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // 1. Validar autenticación
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // 2. Obtener usuario
    const { data: userData } = await supabase.auth.getUser(token);
    
    // 3. Lógica de negocio
    const result = await doSomething(userData.user.id);
    
    // 4. Retornar respuesta
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### APIs por Categoría

#### Autenticación
- **`/api/admin/me`**: Verificar si usuario es admin

#### Productos
- **`/api/listings/create`**: Crear publicación
- **`/api/listings/update`**: Actualizar publicación
- **`/api/listings/clone`**: Clonar publicación

#### Órdenes
- **`/api/checkout/create`**: Crear sesión de checkout
- **`/api/orders/confirm-received`**: Confirmar recepción
- **`/api/orders/mark-shipped`**: Marcar como enviado
- **`/api/orders/label-downloaded`**: Marcar guía como descargada

#### Disputas
- **`/api/disputes/open`**: Abrir disputa
- **`/api/disputes/list`**: Listar disputas del usuario
- **`/api/disputes/messages`**: Mensajes de disputa
- **`/api/admin/disputes/resolve`**: Resolver disputa (admin)

#### Notificaciones
- **`/api/notifications/list`**: Listar notificaciones
- **`/api/notifications/delete`**: Eliminar notificaciones
- **`/api/notifications/mark-read`**: Marcar como leídas

#### Chat
- **`/api/chat/messages`**: Mensajes de chat de orden
- **`/api/chat/read`**: Marcar mensajes como leídos
- **`/api/chat/upload`**: Subir archivo al chat

#### Logística (Admin)
- **`/api/admin/logistica/label/upload`**: Subir guía de envío
- **`/api/admin/logistica/orders/list`**: Listar órdenes para logística

#### Upload
- **`/api/upload`**: Subir imágenes (Cloudinary o Supabase Storage)

### Función Helper Común

```typescript
function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireUserFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) {
    throw new Error('Invalid token');
  }
  return userData.user;
}
```

---

## 🎨 Componentes Frontend Principales

### `AccountTopMenu`
- **Ubicación**: `components/AccountTopMenu.tsx`
- **Propósito**: Menú superior con notificaciones y perfil
- **Características**:
  - Contador de notificaciones no leídas
  - Actualización en tiempo real mediante eventos personalizados (`notifications-updated`)
  - Dropdown de usuario

### `OrderChatFloating`
- **Ubicación**: `components/OrderChatFloating.tsx`
- **Propósito**: Chat flotante para órdenes
- **Características**:
  - Deshabilitado cuando pago está pendiente
  - Efecto de parpadeo rosa cuando pago se acredita
  - Carga de mensajes en tiempo real

### Páginas Principales

#### Dashboard (`app/dashboard/page.tsx`)
- Panel principal del usuario
- Muestra estadísticas, preguntas sin responder, notificaciones
- Verificación de admin

#### Compras (`app/dashboard/compras/page.tsx`)
- Lista de compras del usuario
- Botón "Disputa" parpadeante (rojo)
- Contador de 72 horas para disputas
- Chat con vendedor (deshabilitado si pago pendiente)

#### Ventas (`app/dashboard/ventas/page.tsx`)
- Lista de ventas del usuario
- Botón "Disputa" parpadeante (rojo)
- Contador de 72 horas para disputas
- Descarga de guías de envío
- Chat con comprador (deshabilitado después de 15 días)

#### Devoluciones (`app/dashboard/devoluciones/page.tsx`)
- Lista de disputas del usuario
- Información completa de cada disputa
- Enlaces al chat de disputa

#### Admin - Disputas (`app/admin/disputas/[disputeId]/page.tsx`)
- Panel de administración de disputas
- Chat de administrador
- Resolución definitiva después de 72 horas
- Opciones: asignar nueva guía o mantener dinero al vendedor

#### Admin - Logística (`app/admin/logistica/page.tsx`)
- Gestión de envíos
- Subida de guías de envío (PDF)
- Seguimiento de descargas por vendedores
- Actualizaciones en tiempo real

---

## 🔗 Integraciones Externas

### 1. Cloudinary

**Propósito**: Almacenamiento y procesamiento de imágenes con marca de agua

**Configuración** (`lib/cloudinary/config.ts`):
```typescript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

**Variables de Entorno**:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_WATERMARK` (opcional)

**Uso**:
```typescript
import { uploadImageWithWatermark } from '@/lib/cloudinary/utils';

const imageUrl = await uploadImageWithWatermark(file, {
  folder: 'products',
  watermark: 'watermark-logo',
});
```

**Características**:
- Aplicación automática de marca de agua (30% tamaño, 70% opacidad, esquina inferior derecha)
- Fallback a Supabase Storage si Cloudinary no está configurado
- Optimización automática de imágenes

### 2. MercadoPago

**Propósito**: Procesamiento de pagos online

**APIs**:
- **`/api/mercadopago/preference`**: Crear preferencia de pago
- **`/api/mercadopago/webhook`**: Recibir notificaciones de pago

**Variables de Entorno**:
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY` (opcional, para frontend)

### 3. Supabase Storage

**Propósito**: Almacenamiento de archivos (INE, comprobantes, adjuntos, guías de envío)

**Buckets**:
- `pocket-verification`: Documentos de verificación (INE)
- `pocket-payment-proofs`: Comprobantes de pago offline
- `pocket-support-attachments`: Adjuntos de soporte
- `upload`: Guías de envío (PDFs)
- `pocket-products`: Productos (fallback si no hay Cloudinary)

**Políticas RLS**:
- Usuarios solo pueden subir a sus propias carpetas
- Lectura pública para productos
- Lectura privada para documentos personales

---

## 🔄 Flujos de Datos Principales

### 1. Flujo de Creación de Publicación

```
Usuario llena formulario (app/sell/page.tsx)
    ↓
Sube imágenes → /api/upload → Cloudinary/Supabase Storage
    ↓
Crea publicación → /api/listings/create
    ↓
API valida datos y crea registro en `listings`
    ↓
Retorna ID de publicación
    ↓
Redirige a /dashboard/listings
```

### 2. Flujo de Compra

```
Usuario agrega productos al carrito
    ↓
Va a checkout → /checkout
    ↓
Crea sesión → /api/checkout/create
    ↓
Si pago offline:
    - Crea registro en `checkout_sessions`
    - Genera PDF de comprobante
    - Muestra instrucciones de pago
    ↓
Si pago online:
    - Crea preferencia en MercadoPago
    - Redirige a página de pago
    ↓
Webhook de MercadoPago → /api/mercadopago/webhook
    ↓
Actualiza estado de orden a "paid"
    ↓
Envía notificaciones a comprador y vendedor
```

### 3. Flujo de Disputa

```
Comprador abre disputa → /api/disputes/open
    ↓
Crea registro en `disputes` con status='open'
    ↓
Envía notificación al vendedor
    ↓
Ambas partes ven:
    - Botón "Disputa" parpadeante en rojo
    - Contador de 72 horas en rojo
    ↓
Pueden chatear en /dashboard/disputas/[id]
    ↓
Después de 72 horas:
    - Contador desaparece
    - Admin puede tomar resolución definitiva
    ↓
Admin resuelve → /api/admin/disputes/resolve
    ↓
Actualiza estado de disputa y orden
    ↓
Envía notificaciones a ambas partes
```

### 4. Flujo de Notificaciones

```
Evento ocurre (pregunta, respuesta, orden, etc.)
    ↓
Trigger de base de datos o código backend crea notificación
    ↓
Registro en tabla `notifications`
    ↓
Frontend carga notificaciones → /api/notifications/list
    ↓
Usuario ve contador en `AccountTopMenu`
    ↓
Usuario elimina notificación → /api/notifications/delete
    ↓
API usa `supabaseAdmin()` para bypass RLS
    ↓
Elimina registro permanentemente
    ↓
Dispara evento 'notifications-updated'
    ↓
Componentes se actualizan automáticamente
```

### 5. Flujo de Chat de Orden

```
Usuario hace clic en "Chat con vendedor/comprador"
    ↓
Verifica estado de pago:
    - Si pendiente: Deshabilita chat, muestra mensaje
    - Si pagado: Habilita chat, efecto de parpadeo rosa
    ↓
Carga mensajes → /api/chat/messages
    ↓
Usuario envía mensaje → /api/chat/messages (POST)
    ↓
Guarda en `order_messages`
    ↓
Marca como leído → /api/chat/read
    ↓
Actualiza `order_chat_reads`
```

### 6. Flujo de Guía de Envío

```
Administrador sube guía → /api/admin/logistica/label/upload
    ↓
Sube PDF a Supabase Storage (bucket: upload)
    ↓
Actualiza `orders.shipping_label_url`
    ↓
Crea notificación tipo `shipping_label_ready` al vendedor
    ↓
Vendedor ve notificación
    ↓
Vendedor descarga guía → /api/orders/label-downloaded
    ↓
Marca `orders.label_downloaded_at`
    ↓
Broadcast realtime a admins
```

---

## ⚠️ Errores Comunes y Soluciones

### 1. Error 400 al cargar perfiles (nickname/username no existen)

**Síntoma**:
```
Failed to load resource: the server responded with a status of 400
/profiles?select=id%2Cfull_name%2Cnickname%2Cusername
```

**Causa**: La tabla `profiles` no tiene las columnas `nickname` o `username`.

**Solución**: Implementar fallback automático:
```typescript
let profRes: any = await supabase
  .from('profiles')
  .select('id,full_name,nickname,username')
  .in('id', userIds);

if (profRes.error) {
  const code = String((profRes.error as any)?.code || '');
  const msg = String((profRes.error as any)?.message || '').toLowerCase();
  // Fallback a solo full_name si hay error
  if (code === '42703' || msg.includes('does not exist') || msg.includes('column') || code === '400') {
    profRes = await supabase.from('profiles').select('id,full_name').in('id', userIds);
  }
}
```

### 2. Notificaciones reaparecen después de eliminar

**Síntoma**: Las notificaciones desaparecen al hacer clic en "Eliminar", pero reaparecen al recargar la página.

**Causa**: 
- RLS bloquea la eliminación
- La API no usa `supabaseAdmin()` para bypass RLS
- La eliminación no se persiste en la base de datos

**Solución**:

**Frontend** (`app/dashboard/notificaciones/page.tsx`):
```typescript
const deleteSelected = async () => {
  try {
    const res = await fetch(`/api/notifications/delete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: selectedIds }),
    });
    
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Error al eliminar');
    }
    
    // Esperar confirmación antes de actualizar UI
    await new Promise(resolve => setTimeout(resolve, 1000));
    await load();
    
    // Disparar evento para actualizar otros componentes
    window.dispatchEvent(new Event('notifications-updated'));
  } catch (err) {
    // Manejo de errores
  }
};
```

**Backend** (`app/api/notifications/delete/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin(); // SIEMPRE usar admin para DELETE
  
  // Verificación previa
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .in('id', ids)
    .eq('user_id', userId);
  
  // Eliminación con retorno de filas eliminadas
  const { data: deleted, error } = await admin
    .from('notifications')
    .delete()
    .in('id', ids)
    .eq('user_id', userId)
    .select(); // IMPORTANTE: .select() retorna filas eliminadas
  
  // Verificación post-eliminación
  await new Promise(resolve => setTimeout(resolve, 300));
  const { data: verify } = await admin
    .from('notifications')
    .select('id')
    .in('id', ids);
  
  // Retry si algunas no se eliminaron
  if (verify && verify.length > 0) {
    // Reintentar eliminación
  }
}
```

### 3. Chat de admin en disputas se queda cargando

**Síntoma**: El chat de administrador en `/admin/disputas/[id]` muestra "Cargando..." indefinidamente.

**Causa**: `setIsLoading(true)` se llamaba en cada recarga periódica.

**Solución**: Separar carga inicial de recargas periódicas:
```typescript
useEffect(() => {
  let cancelled = false;
  
  const load = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true); // Solo en carga inicial
    }
    
    try {
      const res = await fetch(`/api/admin/disputes/messages?disputeId=${disputeId}`);
      const json = await res.json();
      
      if (!cancelled) {
        setMessages(json.messages);
        setIsLoading(false);
      }
    } catch (err) {
      if (!cancelled) {
        setIsLoading(false);
        setError(err instanceof Error ? err.message : 'Error');
      }
    }
  };
  
  load(true); // Carga inicial
  const interval = setInterval(() => load(false), 6000); // Recargas silenciosas cada 6s
  
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [disputeId]);
```

### 4. Botón "Disputa" y contador no aparecen

**Síntoma**: El botón "Disputa" y el contador de 72 horas no aparecen en las páginas de compras/ventas.

**Causa**: 
- Los datos de disputas no se están cargando correctamente
- El mapeo `disputeInfoByOrderId` está vacío
- La API no está devolviendo `status` y `created_at`

**Solución**:
```typescript
// 1. Asegurar que loadDisputes se llama
useEffect(() => {
  if (orders.length > 0 && token) {
    loadDisputes();
  }
}, [orders, token]);

// 2. Cargar status y created_at
const loadDisputes = async () => {
  const orderIds = orders.map(o => o.id).filter(Boolean);
  const res = await fetch(`/api/disputes/list?limit=200`);
  const json = await res.json();
  const list = json?.disputes ?? [];
  
  const infoMap: Record<string, { id: string; status: string; created_at: string }> = {};
  for (const d of list) {
    const oid = String(d?.order_id || '').trim();
    const did = String(d?.id || '').trim();
    const status = String(d?.status || 'open').trim();
    const created_at = String(d?.created_at || '').trim();
    
    if (oid && did && orderIds.includes(oid)) {
      infoMap[oid] = { id: did, status, created_at };
    }
  }
  
  setDisputeInfoByOrderId(infoMap);
};

// 3. Verificar que la API devuelve los campos
// En app/api/disputes/list/route.ts
const { data } = await admin
  .from('disputes')
  .select('id,order_id,buyer_id,seller_id,status,created_at,reason_code,reason_text')
  .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
```

### 5. Error "npm no se reconoce" en PowerShell

**Síntoma**: Al ejecutar `npm run dev`, PowerShell muestra error "npm no se reconoce como comando".

**Causa**: Node.js no está en el PATH del sistema.

**Solución** (`iniciar-servidor.ps1`):
```powershell
# Verificar Node.js en ubicaciones comunes
$nodePaths = @(
  "$env:ProgramFiles\nodejs",
  "$env:ProgramFiles(x86)\nodejs",
  "$env:LOCALAPPDATA\Programs\nodejs"
)

$nodeFound = $false
foreach ($path in $nodePaths) {
  if (Test-Path "$path\node.exe") {
    $env:Path = "$path;$env:Path"
    $nodeFound = $true
    Write-Host "Node.js encontrado en: $path"
    break
  }
}

if (-not $nodeFound) {
  Write-Host "ERROR: Node.js no encontrado. Por favor instálalo desde nodejs.org"
  exit 1
}

# Limpiar caché y reiniciar
Remove-Item -Recurse -Force .next-dev -ErrorAction SilentlyContinue
npm run dev
```

---

## 🛠️ Configuración del Entorno

### Variables de Entorno Requeridas

Crear archivo `.env.local` en la raíz del proyecto:

```env
# Supabase (Requerido)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Cloudinary (Opcional, fallback a Supabase Storage)
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
CLOUDINARY_WATERMARK=watermark-logo

# MercadoPago (Opcional, solo si usas pagos online)
MERCADOPAGO_ACCESS_TOKEN=tu-access-token
MERCADOPAGO_PUBLIC_KEY=tu-public-key
```

### Scripts de Desarrollo

**`package.json`**:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### Configuración de Supabase

1. **Crear proyecto en Supabase**
2. **Ejecutar scripts SQL** (en orden):
   - `supabase_profiles_table.sql`
   - `supabase_listings.sql`
   - `supabase_orders.sql`
   - `supabase_disputes.sql`
   - `supabase_notifications.sql`
   - `supabase_orders_logistics.sql`
   - ... (otros según necesidad)

3. **Configurar RLS**:
   - Habilitar RLS en todas las tablas
   - Crear políticas según necesidades

4. **Configurar Storage**:
   - Crear buckets: `pocket-verification`, `pocket-payment-proofs`, `upload`, etc.
   - Configurar políticas de acceso

---

## 📚 Mejores Prácticas

### 1. Manejo de Errores

- Siempre usar `try-catch` en operaciones asíncronas
- Proporcionar mensajes de error descriptivos
- Loggear errores en consola para debugging
- Retornar códigos HTTP apropiados (400, 401, 403, 500)

### 2. Seguridad

- **NUNCA** exponer `SERVICE_ROLE_KEY` al cliente
- Usar `supabaseAdmin()` solo en API routes (server-side)
- Validar tokens en todas las APIs
- Verificar permisos de admin antes de operaciones privilegiadas
- Usar RLS para control de acceso a nivel de fila

### 3. Performance

- Usar `useMemo` para cálculos costosos
- Implementar paginación en listas grandes
- Cargar datos de forma lazy cuando sea posible
- Usar `Suspense` para componentes que usan `useSearchParams`
- Implementar throttling en actualizaciones realtime

### 4. Mantenibilidad

- Documentar funciones complejas
- Usar TypeScript para type safety
- Seguir convenciones de nombres consistentes
- Separar lógica de negocio de componentes UI
- Agregar logs descriptivos con prefijos `[COMPONENT]` o `[API]`

### 5. Testing y Debugging

- Agregar logs descriptivos con prefijos `[COMPONENT]` o `[API]`
- Usar herramientas de desarrollo de React
- Verificar logs del servidor en desarrollo
- Probar en diferentes navegadores

---

## 🎯 Comandos Útiles

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

# Iniciar servidor de producción
npm start

# Linting
npm run lint
```

### Supabase

```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- Verificar que existe una columna
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'nickname';

-- Ver disputas de un usuario
SELECT * FROM disputes 
WHERE buyer_id = 'USER_ID' OR seller_id = 'USER_ID';

-- Ver órdenes con guía
SELECT id, shipping_label_url, shipping_label_uploaded_at, label_downloaded_at
FROM orders
WHERE shipping_label_url IS NOT NULL
ORDER BY shipping_label_uploaded_at DESC;
```

### PowerShell (Windows)

```powershell
# Ejecutar script de inicio
.\iniciar-servidor.ps1

# Verificar Node.js
node --version
npm --version
```

---

## 📖 Documentación Adicional

- **`DOCUMENTACION_TECNICA_COMPLETA.md`**: Documentación técnica detallada
- **`SISTEMA_DISPUTAS_COMPLETO.md`**: Sistema de disputas completo
- **`INTEGRACION_GUIAS_ENVIO.md`**: Integración de guías de envío
- **`INTEGRACION_ENVIOS.md`**: Integración de envíos (T1 Envíos)
- **`SETUP.md`**: Guía de configuración inicial

---

## 🚀 Instrucciones para el Agente

Cuando trabajes con esta aplicación:

1. **Lee este prompt completo** antes de hacer cambios
2. **Consulta la documentación técnica** si necesitas detalles específicos
3. **Sigue los patrones establecidos** (autenticación, manejo de errores, etc.)
4. **Usa `supabaseAdmin()` solo en APIs**, nunca en componentes React
5. **Implementa fallbacks** para columnas opcionales en `profiles`
6. **Valida tokens** en todas las APIs
7. **Agrega logs descriptivos** con prefijos `[COMPONENT]` o `[API]`
8. **Prueba los cambios** en desarrollo antes de confirmar
9. **Documenta cambios complejos** en los archivos correspondientes
10. **Mantén la consistencia** con el código existente

---

**Última actualización**: Enero 2026  
**Versión**: 1.0  
**Autor**: Sistema de Documentación Automática
