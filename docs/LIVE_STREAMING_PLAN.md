# 📺 Plan de Live Streaming para GoPocket

> **Estado:** Posibilidad futura — No implementado  
> **Fecha:** Febrero 2026  
> **Feature exclusivo del Plan Platinum ($999 MXN/mes)**

---

## Concepto

Live Shopping integrado en GoPocket. Los vendedores Platinum transmiten en vivo mostrando productos. Los compradores ven, comentan y compran en tiempo real.

## Tecnología

- **LiveKit** (open source, gratis) — Servidor de streaming WebRTC
- **Hetzner Cloud** — Servidores VPS económicos (datacenter en USA)
- **Supabase Realtime** — Chat en tiempo real (ya existente)

## Infraestructura y Costos

### Servidor: Hetzner Cloud (hetzner.com)

| Servidor | Specs | Lives simultáneos (~50 viewers c/u) | Costo/mes |
|---|---|---|---|
| CX33 | 4 CPU, 8GB RAM, 20TB tráfico | 2-3 | €5.49 (~$120 MXN) |
| CX43 | 8 CPU, 16GB RAM, 20TB tráfico | 5-8 | €9.49 (~$210 MXN) |
| CX53 | 16 CPU, 32GB RAM, 20TB tráfico | 10-15 | €17.49 (~$380 MXN) |

### Escala para 100 lives simultáneos

| Lives simultáneos | Servidores CX53 | Costo/mes |
|---|---|---|
| 20 | 2 | ~$760 MXN |
| 50 | 4 | ~$1,520 MXN |
| 100 | 7 | ~$2,650 MXN |

LiveKit soporta clusters — se agregan servidores y se balancea la carga automáticamente.

### Modelo de negocio

| Vendedores Platinum | Ingreso/mes | Costo servidores | Ganancia |
|---|---|---|---|
| 1 | $999 | $120 | $879 |
| 10 | $9,990 | $380 | $9,610 |
| 50 | $49,950 | $1,520 | $48,430 |
| 100 | $99,900 | $2,650 | $97,250 |

**El costo de infraestructura es ~2.6% del ingreso.**

## Características por fase

### Fase 1 — MVP
- Vendedor inicia live desde su dashboard (cámara del celular/laptop)
- Viewers ven el stream en `/live/[id]`
- Chat en tiempo real con Supabase Realtime
- Vendedor ancla productos (link directo a comprar)
- Contador de viewers
- Notificación a seguidores cuando un vendedor sale en vivo

### Fase 2 — Engagement
- Reacciones con emojis (❤️🔥👏)
- Carrusel de productos anclados
- "Comprar ahora" sin salir del live
- Replay (ver el live después)
- Programar lives con anticipación

### Fase 3 — Subastas en Vivo
- Subasta en tiempo real durante el live
- Timer visual para pujas
- Auto-crear orden al ganar
- Integración con sistema de subastas existente

## Tablas Supabase necesarias

```sql
-- Tabla de lives
CREATE TABLE lives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled, live, ended
  stream_key TEXT,
  playback_url TEXT,
  thumbnail_url TEXT,
  viewer_count INT DEFAULT 0,
  pinned_listing_ids JSONB DEFAULT '[]',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  replay_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de mensajes del live
CREATE TABLE live_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  live_id UUID REFERENCES lives(id),
  user_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  type TEXT DEFAULT 'chat', -- chat, reaction, system
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementación técnica

### Setup del servidor
```bash
# 1. Comprar servidor en hetzner.com (CX33 para empezar)
# 2. Conectarse por SSH
# 3. Instalar LiveKit
curl -sSL https://get.livekit.io | bash

# 4. Configurar con API keys
# 5. Conectar con la app de GoPocket
```

### Paquetes npm necesarios
```bash
npm install livekit-server-sdk livekit-client @livekit/components-react @livekit/components-styles
```

### Limitaciones del plan
- Lives ilimitados en cantidad y duración (sin límite por hora)
- El ancho de banda de 20TB/mes soporta ~4,400 lives de 1hr con 10 viewers
- Solo limitado por CPU (cores) para lives simultáneos

## Lo que yo haría para implementarlo (paso a paso)

### Paso 1 — Agregar plan Platinum al sistema
- Modificar `lib/plans/limits.ts`: agregar `'platinum'` al tipo `PlanType` y definir sus límites (comisión 13-15%, listings ilimitados, lives habilitados)
- Modificar `profiles` en Supabase: aceptar `plan_type = 'platinum'`
- Agregar campos de suscripción Platinum (`platinum_subscription_end`)
- Actualizar `getPlan()` y `checkLimit()` para reconocer el plan

### Paso 2 — Crear tablas en Supabase
- Crear tabla `lives` (id, seller_id, title, status, stream_key, playback_url, viewer_count, pinned_listing_ids, etc.)
- Crear tabla `live_messages` (id, live_id, user_id, message, type, created_at)
- Configurar Realtime en la tabla `live_messages` para el chat en vivo
- Crear políticas RLS de seguridad

### Paso 3 — Conectar con LiveKit
- Instalar paquetes: `livekit-server-sdk`, `livekit-client`, `@livekit/components-react`
- Crear variables de entorno: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- Crear helper `lib/livekit.ts` para generar tokens de acceso (vendedor como publisher, viewers como subscribers)

### Paso 4 — API Routes (Next.js)
- `POST /api/lives/create` — Vendedor crea un nuevo live (valida que sea Platinum, genera stream key en LiveKit, inserta en tabla `lives`)
- `POST /api/lives/start` — Marca el live como "en vivo", actualiza `started_at`
- `POST /api/lives/end` — Marca el live como "terminado", actualiza `ended_at`
- `GET /api/lives/token` — Genera token de LiveKit para viewers (subscriber) o vendedor (publisher)
- `POST /api/lives/pin-product` — Ancla un listing al live actual
- `GET /api/lives/active` — Lista todos los lives activos ahora (para la home)

### Paso 5 — Página del vendedor: `/dashboard/live`
- Botón "Iniciar Live" (solo visible si es Platinum)
- Formulario: título del live, seleccionar productos a mostrar
- Al iniciar: abre cámara con WebRTC usando LiveKit SDK
- Vista del chat en tiempo real (Supabase Realtime)
- Botón para anclar/desanclar productos durante la transmisión
- Contador de viewers en vivo
- Botón "Terminar Live"

### Paso 6 — Página del viewer: `/live/[id]`
- Reproductor de video (LiveKit player component)
- Chat en tiempo real (mensajes con Supabase Realtime channel)
- Panel lateral con productos anclados por el vendedor
- Botón "Comprar" que lleva directo al checkout sin salir de la página
- Reacciones con emojis (broadcast channel)
- Info del vendedor (nombre, tienda, reputación)

### Paso 7 — Integrar en la Home
- Sección "🔴 En Vivo Ahora" en la página principal
- Carrusel con thumbnails de los lives activos
- Badge rojo pulsante "LIVE" en las cards
- Click lleva a `/live/[id]`

### Paso 8 — Notificaciones
- Cuando un vendedor Platinum inicia un live, enviar notificación a sus seguidores
- Usar el sistema de notificaciones existente (tabla `notifications`)

### Paso 9 — Cron Jobs
- Agregar job en `lib/automation/jobs.ts`:
  - Auto-terminar lives que llevan más de X horas (protección)
  - Limpiar lives viejos sin replay

### Paso 10 — UI de planes
- Actualizar la página de planes para mostrar Platinum como tercer nivel
- Destacar "Lives en Vivo" como feature principal de Platinum
- Botón de upgrade de Pro → Platinum

## Notas
- No se compra hardware físico — todo es en la nube
- Servidor se renta mes a mes, sin contrato
- LiveKit es open source — sin costo de licencia
- Se escala agregando más servidores al cluster
- Alternativa gratis: embeder YouTube/Facebook Live ($0 costo, menos integración)
- Se necesita el servidor de Hetzner ANTES de empezar (yo lo configuro)
