# 🤖 Guía para Agentes de Cursor - Pocket App

Esta guía está diseñada específicamente para agentes de Cursor que necesitan configurar o reconectar el proyecto desde cero.

---

## 🎯 Objetivo

Reconectar y configurar completamente el proyecto Pocket App en una nueva computadora o entorno, asegurando que todas las funcionalidades trabajen correctamente.

---

## 📋 Checklist de Configuración

### Paso 1: Verificar Entorno Base

```bash
# Verificar Node.js (debe ser v18+)
node --version

# Verificar npm
npm --version

# Si no están instalados, instalar Node.js desde nodejs.org
```

### Paso 2: Clonar/Descargar el Proyecto

```bash
# Si es un repositorio Git
git clone <url-del-repositorio>
cd Pocket-App

# O si ya tienes el proyecto, navegar a la carpeta
cd Pocket-App
```

### Paso 3: Instalar Dependencias

```bash
# Limpiar cualquier instalación previa (si existe)
rm -rf node_modules package-lock.json .next

# Instalar dependencias
npm install

# Verificar que no hay errores
npm run build
```

**Si hay errores de compilación**, ver sección "Errores Comunes de Compilación" más abajo.

---

## 🔐 Configuración de Variables de Entorno

### Crear archivo `.env.local`

Crea un archivo `.env.local` en la raíz del proyecto con estas variables:

```env
# ============================================
# SUPABASE (CRÍTICO - Obtener de Supabase Dashboard)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# CLOUDINARY (CRÍTICO - Obtener de Cloudinary Dashboard)
# ============================================
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz

# ============================================
# MERCADOPAGO (Opcional)
# ============================================
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxx
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxx

# ============================================
# URLs (Importante para links internos)
# ============================================
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Dónde Obtener las Credenciales

1. **Supabase**:
   - Ir a: https://supabase.com/dashboard
   - Seleccionar el proyecto
   - Settings → API
   - Copiar `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copiar `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copiar `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ NUNCA exponer en cliente)

2. **Cloudinary**:
   - Ir a: https://cloudinary.com/console
   - Dashboard → Settings → Access Keys
   - Copiar `Cloud name` → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - Copiar `API Key` → `CLOUDINARY_API_KEY`
   - Copiar `API Secret` → `CLOUDINARY_API_SECRET`

3. **MercadoPago** (opcional):
   - Ir a: https://www.mercadopago.com.mx/developers
   - Credenciales → Copiar Public Key y Access Token

---

## 🗄️ Configuración de Base de Datos (Supabase)

### Orden CRÍTICO de Ejecución de Scripts SQL

**IMPORTANTE**: Ejecuta estos scripts en Supabase → SQL Editor en el orden exacto indicado:

1. ✅ **`supabase_notifications.sql`**
   - Crea la tabla `notifications` y tipos ENUM básicos
   - **Verificar**: `SELECT * FROM notifications LIMIT 1;` (debe funcionar)

2. ✅ **`supabase_notifications_enum_extend.sql`**
   - Extiende el ENUM `notification_type` con tipos adicionales
   - **Verificar**: `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type');`

3. ✅ **`supabase_notifications_triggers.sql`**
   - Crea triggers automáticos para notificaciones
   - **Verificar**: `SELECT * FROM pg_trigger WHERE tgname LIKE '%notify%';`

4. ✅ **`supabase_support_chat.sql`**
   - Crea tablas y funciones para chat de soporte
   - **Verificar**: `SELECT * FROM support_conversations LIMIT 1;`

5. ✅ **`supabase_disputes.sql`**
   - Crea sistema de disputas
   - **Verificar**: `SELECT * FROM disputes LIMIT 1;`

6. ✅ **`supabase_profiles_payout_migration.sql`**
   - Agrega campos de pago a vendedores en `profiles`
   - **Verificar**: `SELECT payout_bank_name, payout_clabe FROM profiles LIMIT 1;`

7. ✅ **`supabase_orders_paid_to_seller.sql`**
   - Agrega tracking de pagos a vendedores en `orders`
   - **Verificar**: `SELECT paid_to_seller_at FROM orders LIMIT 1;`

### Después de Ejecutar Scripts

```sql
-- Recargar schema de PostgREST (importante)
SELECT pg_notify('pgrst', 'reload schema');
```

### Verificar Configuración de Base de Datos

```sql
-- Verificar que las tablas principales existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'notifications',
  'support_conversations',
  'support_messages',
  'disputes',
  'dispute_messages',
  'orders',
  'profiles'
);

-- Verificar que Realtime está habilitado
SELECT * FROM pg_extension WHERE extname = 'realtime';
```

---

## 🔧 Verificación de Configuración

### Test 1: Compilación

```bash
npm run build
```

**Si falla**, ver sección "Errores Comunes de Compilación".

### Test 2: Servidor de Desarrollo

```bash
npm run dev
```

Abrir: http://localhost:3000

**Verificar**:
- ✅ La página carga sin errores
- ✅ No hay errores en la consola del navegador
- ✅ No hay errores en la terminal del servidor

### Test 3: Autenticación

1. Intentar registrarse/iniciar sesión
2. Verificar que redirige correctamente
3. Verificar que la sesión persiste

### Test 4: Notificaciones

1. Iniciar sesión como usuario
2. Visitar: `/dashboard/notificaciones?debug=1`
3. Verificar que carga sin errores
4. Verificar que muestra información de debug

---

## 🐛 Errores Comunes de Compilación

### Error 1: `insertNotificationBestEffort` definido múltiples veces

**Archivo**: `app/api/admin/payments/offline/update/route.ts`

**Solución**:
```typescript
// ❌ ELIMINAR esta función local si existe
async function insertNotificationBestEffort(admin: any, payload: any) { ... }

// ✅ Usar solo la importada
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
```

### Error 2: `Type 'Set<string>' can only be iterated`

**Archivos afectados**: 
- `app/api/disputes/messages/route.ts`
- Cualquier archivo que itere sobre `Set`

**Solución**:
```typescript
// ❌ INCORRECTO
for (const uid of notifyTargets) { ... }

// ✅ CORRECTO
for (const uid of Array.from(notifyTargets)) { ... }
```

### Error 3: `Type 'RegExpStringIterator' can only be iterated`

**Archivo**: `lib/moderation/listingContentPolicy.ts`

**Solución**:
```typescript
// ❌ INCORRECTO
for (const m of text.matchAll(re)) { ... }

// ✅ CORRECTO
for (const m of Array.from(text.matchAll(re))) { ... }
```

### Error 4: Error de tipos en banners

**Archivo**: `app/admin/banners/page.tsx`

**Solución**:
```typescript
// ✅ CORRECTO
if (!data) throw new Error('No se recibió data del insert');
setRows((prev) => [data as unknown as BannerRow, ...prev]);
```

### Solución Rápida para Todos los Errores

```bash
# 1. Limpiar caché
rm -rf .next .next-dev node_modules package-lock.json

# 2. Reinstalar
npm install

# 3. Verificar build
npm run build

# 4. Si aún falla, revisar errores específicos arriba
```

---

## 🔍 Verificación de Funcionalidades Críticas

### 1. Sistema de Notificaciones

**Verificar**:
- [ ] Tabla `notifications` existe en Supabase
- [ ] ENUM `notification_type` tiene todos los tipos necesarios
- [ ] Triggers están activos
- [ ] El punto rosa aparece en `/dashboard`
- [ ] Las notificaciones se crean cuando corresponda

**Debug**: Visitar `/dashboard/notificaciones?debug=1`

### 2. Chat de Soporte

**Verificar**:
- [ ] Tablas `support_conversations` y `support_messages` existen
- [ ] Los usuarios pueden crear conversaciones
- [ ] Los admins pueden responder
- [ ] Las notificaciones llegan

### 3. Sistema de Disputas

**Verificar**:
- [ ] Tablas `disputes` y `dispute_messages` existen
- [ ] Los compradores pueden iniciar disputas
- [ ] Los vendedores y admins pueden responder
- [ ] Las notificaciones llegan a todos los involucrados

### 4. Pagos a Vendedores

**Verificar**:
- [ ] Tabla `profiles` tiene campos `payout_*`
- [ ] Tabla `orders` tiene campos `paid_to_seller_at` y `paid_to_seller_by`
- [ ] El panel `/admin/metricas` muestra la sección de pagos
- [ ] Los filtros funcionan correctamente

---

## 🚨 Problemas Críticos y Soluciones Rápidas

### Problema: "No carga ninguna página"

**Diagnóstico**:
```bash
# 1. Verificar errores de compilación
npm run build

# 2. Verificar variables de entorno
cat .env.local | grep SUPABASE

# 3. Limpiar caché
rm -rf .next .next-dev
npm run dev
```

**Solución**: Ver sección "Errores Comunes de Compilación"

### Problema: "Notificaciones no funcionan"

**Diagnóstico**:
1. Verificar que se ejecutaron los scripts SQL en orden
2. Verificar triggers: `SELECT * FROM pg_trigger WHERE tgname LIKE '%notify%';`
3. Usar modo debug: `/dashboard/notificaciones?debug=1`

**Solución**: Ejecutar scripts SQL faltantes en orden

### Problema: "Chat parpadea constantemente"

**Ya está resuelto** en el código actual usando `isInitialLoading` separado.

Si persiste:
```typescript
// Verificar en OrderChatFloating.tsx que use:
const [isInitialLoading, setIsInitialLoading] = useState(true);
// Y NO:
const [isLoading, setIsLoading] = useState(false);
```

### Problema: "Errores de base de datos"

**Diagnóstico**:
```sql
-- Verificar que las tablas existen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Recargar schema
SELECT pg_notify('pgrst', 'reload schema');
```

**Solución**: Ejecutar scripts SQL faltantes

---

## 📝 Comandos de Mantenimiento

### Limpieza Completa

```bash
# Limpiar todo y empezar de nuevo
rm -rf .next .next-dev node_modules package-lock.json
npm install
npm run build
```

### Verificar Estado del Proyecto

```bash
# Verificar dependencias
npm outdated

# Verificar errores de lint
npm run lint

# Verificar tipos TypeScript
npx tsc --noEmit
```

### Recargar Schema de Supabase

```sql
-- En Supabase SQL Editor
SELECT pg_notify('pgrst', 'reload schema');
```

---

## 🎯 Checklist Final de Verificación

Antes de considerar el proyecto "reconectado", verificar:

- [ ] ✅ `npm install` ejecutado sin errores
- [ ] ✅ `.env.local` configurado con todas las variables
- [ ] ✅ Todos los scripts SQL ejecutados en orden
- [ ] ✅ `npm run build` compila sin errores
- [ ] ✅ `npm run dev` inicia sin errores
- [ ] ✅ La página principal carga en `http://localhost:3000`
- [ ] ✅ Autenticación funciona (registro/login)
- [ ] ✅ Notificaciones funcionan (punto rosa visible)
- [ ] ✅ Chat de soporte funciona
- [ ] ✅ Sistema de disputas funciona
- [ ] ✅ Panel de admin carga correctamente
- [ ] ✅ No hay errores en consola del navegador
- [ ] ✅ No hay errores en terminal del servidor

---

## 📚 Archivos de Referencia

- **SETUP.md**: Guía completa de configuración
- **PROBLEMAS_RESUELTOS.md**: Historial de problemas y soluciones
- **README.md**: Documentación general del proyecto

---

## 🆘 Si Nada Funciona

1. **Verificar Node.js**: Debe ser v18 o superior
2. **Limpiar completamente**:
   ```bash
   rm -rf .next .next-dev node_modules package-lock.json
   npm install
   ```
3. **Verificar variables de entorno**: Todas deben estar configuradas
4. **Verificar scripts SQL**: Todos deben estar ejecutados
5. **Revisar logs**: Tanto del servidor como del navegador
6. **Consultar PROBLEMAS_RESUELTOS.md**: Buscar el problema específico

---

## 💡 Tips para Agentes de Cursor

1. **Siempre verificar errores de compilación primero**: `npm run build`
2. **Usar `Array.from()` para iterar sobre Sets/Iterators**
3. **No duplicar funciones importadas**: Usar solo las importadas
4. **Verificar orden de scripts SQL**: Es crítico
5. **Limpiar caché cuando hay problemas**: `rm -rf .next`
6. **Usar modo debug de notificaciones**: `/dashboard/notificaciones?debug=1`

---

**Última actualización**: Enero 2026
**Versión del proyecto**: 0.1.0
