# 🚀 Pocket App - Guía de Configuración y Resolución de Problemas

Este documento contiene toda la información necesaria para configurar el proyecto desde cero y resolver problemas comunes.

---

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Variables de Entorno](#variables-de-entorno)
3. [Instalación de Dependencias](#instalación-de-dependencias)
4. [Configuración de Supabase](#configuración-de-supabase)
5. [Scripts SQL Requeridos](#scripts-sql-requeridos)
6. [Problemas Comunes y Soluciones](#problemas-comunes-y-soluciones)
7. [Estructura del Proyecto](#estructura-del-proyecto)
8. [Comandos Importantes](#comandos-importantes)

---

## 🔧 Configuración Inicial

### Requisitos Previos

- **Node.js**: v18 o superior
- **npm** o **yarn**
- **Cuenta de Supabase** (gratuita)
- **Cuenta de Cloudinary** (para imágenes)
- **Cuenta de MercadoPago** (para pagos)

### Pasos de Instalación

```bash
# 1. Clonar o descargar el proyecto
cd Pocket-App

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (ver sección siguiente)
cp .env.example .env.local

# 4. Ejecutar scripts SQL en Supabase (ver sección de SQL)
# 5. Iniciar servidor de desarrollo
npm run dev
```

---

## 🔐 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Cloudinary (para imágenes)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# MercadoPago (opcional, para pagos)
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=tu-public-key
MERCADOPAGO_ACCESS_TOKEN=tu-access-token

# URL del sitio (importante para links internos)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# En producción: NEXT_PUBLIC_SITE_URL=https://tu-dominio.com

# Otros
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Dónde Obtener las Keys

1. **Supabase**: Dashboard → Settings → API
2. **Cloudinary**: Dashboard → Settings → Access Keys
3. **MercadoPago**: Dashboard → Credenciales

---

## 📦 Instalación de Dependencias

El proyecto usa las siguientes dependencias principales:

```json
{
  "next": "14.2.35",
  "react": "^18",
  "@supabase/supabase-js": "^2.x",
  "tailwindcss": "^3.x",
  "typescript": "^5.x"
}
```

Si hay problemas con dependencias:

```bash
# Limpiar e instalar de nuevo
rm -rf node_modules package-lock.json
npm install

# O si usas yarn
rm -rf node_modules yarn.lock
yarn install
```

---

## 🗄️ Configuración de Supabase

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Anota la URL y las keys (ver Variables de Entorno)

### 2. Habilitar Extensiones

En Supabase → SQL Editor, ejecuta:

```sql
-- Habilitar Realtime (para chats en tiempo real)
CREATE EXTENSION IF NOT EXISTS "realtime";

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 3. Configurar Row Level Security (RLS)

Las políticas RLS se configuran en cada script SQL. Asegúrate de ejecutarlos en orden.

---

## 📜 Scripts SQL Requeridos

**IMPORTANTE**: Ejecuta estos scripts en Supabase → SQL Editor en el orden indicado:

### Orden de Ejecución

1. **`supabase_notifications.sql`** - Sistema de notificaciones
2. **`supabase_notifications_enum_extend.sql`** - Tipos de notificaciones
3. **`supabase_notifications_triggers.sql`** - Triggers automáticos
4. **`supabase_support_chat.sql`** - Chat de soporte
5. **`supabase_disputes.sql`** - Sistema de disputas
6. **`supabase_profiles_payout_migration.sql`** - Campos de pago a vendedores
7. **`supabase_orders_paid_to_seller.sql`** - Tracking de pagos a vendedores

### Notas Importantes

- Todos los scripts son **idempotentes** (puedes ejecutarlos múltiples veces sin problemas)
- Si un script falla, revisa el error y corrige antes de continuar
- Después de ejecutar scripts, puede ser necesario recargar el schema de PostgREST:
  ```sql
  SELECT pg_notify('pgrst', 'reload schema');
  ```

---

## 🐛 Problemas Comunes y Soluciones

### 1. "No carga ninguna página" / Errores de Compilación

**Síntomas**: 
- Páginas en blanco
- Errores en consola del navegador
- Build falla

**Soluciones**:

```bash
# 1. Limpiar caché de Next.js
rm -rf .next .next-dev

# 2. Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install

# 3. Verificar errores de TypeScript
npm run build

# 4. Si hay errores de tipos, revisar:
# - Iteradores sobre Set/Map: usar Array.from()
# - matchAll(): usar Array.from(text.matchAll(re))
# - Funciones duplicadas: eliminar definiciones locales si ya están importadas
```

**Errores Específicos Resueltos**:

- **`insertNotificationBestEffort` definido múltiples veces**: Eliminar función local, usar solo la importada
- **`Type 'Set<string>' can only be iterated`**: Usar `Array.from(set)` antes de iterar
- **`Type 'RegExpStringIterator' can only be iterated`**: Usar `Array.from(text.matchAll(re))`
- **Errores de tipos en banners**: Usar `as unknown as Tipo` cuando sea necesario

### 2. Errores de Base de Datos / Supabase

**Síntomas**:
- `table does not exist`
- `column does not exist`
- `invalid input value for enum`

**Soluciones**:

```sql
-- 1. Verificar que las tablas existan
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. Recargar schema de PostgREST
SELECT pg_notify('pgrst', 'reload schema');

-- 3. Verificar ENUMs
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type');
```

**Errores Específicos**:

- **`22P02 invalid input value for enum notification_type`**: 
  - Ejecutar `supabase_notifications_enum_extend.sql`
  - O usar `insertNotificationBestEffort` que maneja fallbacks

- **`column notifications.message does not exist`**:
  - El schema usa `body` en lugar de `message`
  - El código ya maneja esto automáticamente

### 3. Problemas con Notificaciones

**Síntomas**:
- No llegan notificaciones
- El punto rosa no se ilumina
- Notificaciones duplicadas

**Soluciones**:

1. Verificar que se ejecutaron los scripts SQL en orden
2. Revisar triggers en `supabase_notifications_triggers.sql`
3. Usar modo debug: `/dashboard/notificaciones?debug=1`
4. Verificar que `AccountTopMenu` no esté oculto en rutas del dashboard

### 4. Problemas con Chat / Tiempo Real

**Síntomas**:
- Chat parpadea constantemente
- Mensajes no aparecen en tiempo real
- "Cargando..." permanente

**Soluciones**:

- **Chat parpadea**: Ya corregido usando `isInitialLoading` separado del polling
- **No actualiza en tiempo real**: 
  - Verificar que Realtime esté habilitado en Supabase
  - Revisar suscripciones en el código (canales de Supabase)
  - Usar polling como fallback (ya implementado)

### 5. Problemas con Imágenes / Cloudinary

**Síntomas**:
- Imágenes no cargan
- Errores de CORS
- Transformaciones no funcionan

**Soluciones**:

1. Verificar variables de entorno de Cloudinary
2. Verificar que las URLs de Cloudinary sean públicas
3. Usar transformaciones: `https://res.cloudinary.com/CLOUD_NAME/image/upload/w_500,h_500/IMAGE_ID`

### 6. Problemas de Autenticación

**Síntomas**:
- No puede iniciar sesión
- Sesión expira inmediatamente
- Errores de "Unauthorized"

**Soluciones**:

1. Verificar que las keys de Supabase sean correctas
2. Verificar RLS policies en Supabase
3. Limpiar cookies/localStorage del navegador
4. Verificar que `supabase.auth.getSession()` funcione

---

## 📁 Estructura del Proyecto

```
Pocket-App/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/                # Endpoints de administración
│   │   ├── chat/                 # Chat de órdenes
│   │   ├── disputes/             # Sistema de disputas
│   │   ├── notifications/        # Notificaciones
│   │   └── support/              # Soporte técnico
│   ├── admin/                    # Panel de administración
│   ├── dashboard/                # Panel de usuario
│   ├── listings/                 # Publicaciones
│   └── page.tsx                  # Página principal
├── components/                   # Componentes React
│   ├── AccountTopMenu.tsx       # Menú superior con notificaciones
│   └── OrderChatFloating.tsx    # Chat flotante de órdenes
├── lib/                          # Utilidades y helpers
│   ├── notifications/            # Sistema de notificaciones
│   ├── moderation/               # Políticas de contenido
│   └── supabase/                 # Cliente de Supabase
├── supabase_*.sql               # Scripts SQL para Supabase
└── SETUP.md                     # Este archivo
```

---

## 🎯 Comandos Importantes

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run build            # Compilar para producción
npm run start            # Iniciar servidor de producción
npm run lint             # Verificar código con ESLint

# Limpieza
rm -rf .next             # Limpiar caché de Next.js
rm -rf node_modules      # Eliminar dependencias
npm install              # Reinstalar dependencias

# Base de datos
# Ejecutar scripts SQL en Supabase → SQL Editor
```

---

## 🔍 Debugging

### Modo Debug de Notificaciones

Visita: `/dashboard/notificaciones?debug=1`

Muestra información detallada sobre:
- Estado de la tabla de notificaciones
- Errores de schema
- Notificaciones sin leer
- Respuestas de la API

### Logs del Servidor

Los logs importantes se muestran en la consola del servidor:
- Errores de API
- Fallos de notificaciones
- Problemas de autenticación

### Herramientas de Desarrollo

- **React DevTools**: Para inspeccionar componentes
- **Network Tab**: Para ver requests a la API
- **Console**: Para ver errores de JavaScript

---

## 📝 Notas Importantes

### Seguridad

- **NUNCA** commitees el archivo `.env.local` al repositorio
- La `SUPABASE_SERVICE_ROLE_KEY` solo debe usarse en el servidor
- Las políticas RLS son críticas para la seguridad

### Performance

- Las imágenes se optimizan automáticamente con Cloudinary
- Los filtros usan `useMemo` para evitar re-renders innecesarios
- El polling se limita a intervalos razonables (6 segundos)

### Mantenimiento

- Revisar logs de Supabase regularmente
- Monitorear uso de Cloudinary (límites del plan)
- Actualizar dependencias periódicamente: `npm outdated`

---

## 🆘 Soporte

Si encuentras un problema no documentado:

1. Revisa los logs del servidor
2. Revisa la consola del navegador
3. Verifica que todos los scripts SQL estén ejecutados
4. Verifica las variables de entorno
5. Limpia el caché de Next.js

---

## 📚 Recursos Adicionales

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Cloudinary](https://cloudinary.com/documentation)
- [Documentación de Tailwind CSS](https://tailwindcss.com/docs)

---

**Última actualización**: Enero 2026
**Versión del proyecto**: 0.1.0
