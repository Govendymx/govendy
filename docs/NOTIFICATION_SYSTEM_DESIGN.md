# Sistema de Notificaciones – Diseño (Marketplace)

**Stack:** Next.js 14 + Supabase (PostgreSQL) + Tailwind CSS  
**Objetivo:** Notificaciones robustas, escalables y en tiempo real (estilo Mercado Libre / eBay).

---

## 1. Esquema de Base de Datos

### Tabla `notifications`

| Columna    | Tipo        | Descripción                                      |
|-----------|-------------|--------------------------------------------------|
| `id`      | UUID        | PK, `gen_random_uuid()`                          |
| `user_id` | UUID        | Destinatario (NOT NULL)                          |
| `type`    | TEXT        | Tipo de evento (véase abajo)                     |
| `title`   | TEXT        | Título breve                                     |
| `body`    | TEXT        | Cuerpo / `message` (compat)                      |
| `link_to` | TEXT        | Ruta en la app (ej. `/dashboard/ventas?order=…`) |
| `data`    | JSONB       | Payload extra (ids, metadatos)                   |
| `is_read` | BOOLEAN     | Default `false`                                  |
| `created_at` | TIMESTAMPTZ | Default `NOW()`                               |

**Índices:** `user_id`, `(user_id, created_at DESC)`, `is_read` WHERE `is_read = false`, `type` WHERE `type IS NOT NULL`.

**Nombres canónicos (evitar cambios para no generar conflictos):**
- Tabla: `notifications` (siempre).
- Columnas: `body` (texto del mensaje; compat con `message` en lectura), `type`, `title`, `link_to`, `data`, `is_read`, `created_at`.
- API: `/api/notifications/list`, `/api/notifications/mark-read`. Rutas: `/dashboard/notificaciones` para "Ver todas".

- **Persistencia:** Supabase/PostgreSQL.
- **Tiempo real:** Supabase Realtime (`postgres_changes` en `notifications` filtrado por `user_id`).
- **`link_to`:** Se usa cuando existe; si no, se deriva de `data` + `type` vía `getNotificationLink()`.

---

## 2. Tipos de Eventos (`type`)

| Tipo              | Quién recibe | Descripción                              |
|-------------------|-------------|------------------------------------------|
| `listing_question`| Vendedor    | Nueva pregunta en publicación            |
| `listing_answer`  | Comprador   | Respuesta a su pregunta                  |
| `new_sale`        | Vendedor    | Venta realizada (procesar stock)         |
| `sale_paid`       | Vendedor    | Pago acreditado → preparar envío         |
| `payment_approved`| Comprador   | Compra exitosa / confirmación de pago    |
| `payment_rejected`| Comprador   | Pago rechazado                           |
| `auction_won`     | Comprador   | Ganó la subasta al terminar              |
| `auction_ended`   | Vendedor    | Subasta finalizada                       |
| `auction_ended`   | Perdedores  | Subasta finalizada (no ganaron)          |
| `outbid`          | Pujador     | Le superaron la puja                     |

---

## 3. Arquitectura: Servicio + Patrón Observer

```
                    ┌─────────────────────────────────────────┐
                    │     NotificationService.notify()       │
                    │  (punto único de entrada)              │
                    └─────────────────┬─────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  Persistencia (BD)  │   │  Realtime           │   │  Hooks              │
│  insert → Supabase  │   │  postgres_changes   │   │  push / email       │
│  notifications      │   │  (automático)       │   │  (lógica para       │
│                     │   │                     │   │   disparar)         │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

- **Desacoplamiento:** Añadir un nuevo `type` = definir payload + opcionalmente handler en hooks. El servicio sigue siendo `notify({ type, userId, ... })`.
- **Hooks:** `onNotify?: (n) => void`. Se llama después de insertar; ahí se puede encolar push (FCM, etc.) o email (Nodemailer, etc.). Por ahora solo la **lógica para dispararlos** (stub).

---

## 4. Funciones del Lado Servidor (Disparo por Evento)

| Evento              | Dónde se dispara                    | Acción                                                |
|---------------------|-------------------------------------|-------------------------------------------------------|
| Pregunta nueva      | Trigger PG `listing_questions` INSERT | `notify_seller_on_new_question`                      |
| Respuesta           | Trigger PG `listing_questions` UPDATE | `notify_asker_on_question_answer`                    |
| Venta / pago        | Webhook MercadoPago                 | `notify` comprador (`payment_approved`) + vendedores (`sale_paid`) |
| Subasta terminada   | API `/api/auctions/settle`          | `notify` vendedor + ganador (`auction_won`) + perdedores (`auction_ended`) |
| Puja superada       | API `/api/bids/place`               | `notify` anterior mayor postor (`outbid`)             |

Los “controladores” son: triggers en BD, webhook MP y rutas API. Todos acaban llamando al **servicio de notificaciones** (o insert directo + hooks donde ya se usa `insertBestEffort`).

---

## 5. Centro de Notificaciones (UI)

- **Componente:** `NotificationCenter` (campana en header).
- **Contenido:** Contador de no leídas + lista (dropdown o panel).
- **Estilos por tipo:**  
  Ventas → verde; Compras → azul; Preguntas/respuestas → rosa; Subastas → amarillo; Errores/rechazos → rojo.
- **Acciones:** Marcar como leída al hacer clic; “Marcar todas como leídas” (masivo).
- **Tiempo real:** Suscripción a `postgres_changes` en `notifications` por `user_id` + polling de respaldo.

---

## 6. Marcar como Leídas

- **Individual:** `POST /api/notifications/mark-read` con `{ ids: [id] }`.
- **Masivo:** `{ all: true }` para todas las no leídas del usuario.
- El frontend actualiza estado optimista y sincroniza con la API.

---

## 7. Resumen de Entregables

1. **Esquema BD:** Tabla `notifications` con `user_id`, `type`, `message`/`body`, `link_to`, `is_read`, `created_at` (+ `title`, `data`).
2. **Servicio:** `NotificationService` + hooks para push/email (solo lógica de disparo).
3. **Controladores:** Triggers (preguntas/respuestas), webhook (venta/compra), settle (subastas + perdedores), bids (outbid).
4. **UI:** Centro de notificaciones (campana), contador, lista por tipo, marcar leídas individual y masivo.
