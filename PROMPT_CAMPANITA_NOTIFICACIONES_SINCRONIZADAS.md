# PROMPT: Campanita de notificaciones conectada y sincronizada en toda la plataforma

## OBJETIVO

Conectar la **campanita de notificaciones** (ícono de campana en el header) con **todas** las notificaciones de la plataforma. Permitir **borrar** notificaciones desde:
- La **campanita** (dropdown al hacer clic)
- El **panel de notificaciones** del dashboard
- La **página /dashboard/notificaciones** (“Ver todas”)

Cuando se borre una notificación **en cualquiera de esos sitios**, debe **desaparecer en todos** (campanita, panel, página de notificaciones). Es decir: **una sola fuente de verdad** y sincronización en tiempo real en toda la app.

---

## ARQUITECTURA ACTUAL (qué ya existe)

### Componentes
- **`components/NotificationCenter.tsx`**: Campanita en el header. Muestra lista de no leídas, “Marcar todas como leídas”, enlace “Ver todas en el panel”. **Solo marca como leída**, no borra.
- **`components/NotificationsPanel.tsx`**: Panel “Notificaciones Recientes” en el dashboard. **Solo marca como leída** al hacer clic. **No escucha** `notifications-updated`.
- **`app/dashboard/notificaciones/page.tsx`**: Página “Tu bandeja” con todas las notificaciones. Marca como leídas (una o todas). **No tiene borrado**.
- **`app/api/notifications/delete/route.ts`**: API de borrado. Acepta `POST` con body `{ ids: string[] }` (borrar por IDs) o `{ all: true }` (borrar todas las no leídas). Authorization: `Bearer <token>`.

### Evento global
- **`notifications-updated`**: Evento personalizado en `window`. Quien **borra** o **marca como leída** debe hacer `window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { ... } }))`. Quien **muestra** notificaciones debe escucharlo y **refrescar** su lista (recargar desde API o quitar de estado local los IDs borrados).

### Quién dispara y quién escucha hoy
| Componente              | Dispara `notifications-updated`     | Escucha `notifications-updated` |
|-------------------------|-------------------------------------|---------------------------------|
| NotificationCenter      | Sí (al marcar leídas)               | Sí                              |
| NotificationsPanel      | No                                  | No                              |
| /dashboard/notificaciones | Sí (al marcar leídas)             | Sí                              |
| AccountTopMenu          | Sí (legacy, al borrar)              | Sí                              |

---

## REQUERIMIENTOS ESPECÍFICOS

### 1. BORRAR DESDE LA CAMPANITA (`NotificationCenter`)

- Añadir **botón “Eliminar” / “Borrar”** por cada notificación en el dropdown (por ejemplo, icono X o texto “Borrar”).
- Añadir **“Eliminar todas”** o **“Borrar todas las no leídas”** en la cabecera del dropdown (junto a “Marcar todas como leídas”).
- Al borrar **una**:
  - `POST /api/notifications/delete` con `{ ids: [id] }`.
  - Quitarla del estado local de `NotificationCenter`.
  - Disparar `notifications-updated` con `detail: { deleted: true, deletedIds: [id], source: 'notification-center' }`.
- Al borrar **todas**:
  - `POST /api/notifications/delete` con `{ all: true }`.
  - Vaciar la lista local de no leídas y actualizar contador.
  - Disparar `notifications-updated` con `detail: { deleted: true, all: true, source: 'notification-center' }`.

### 2. BORRAR DESDE EL PANEL DE NOTIFICACIONES (`NotificationsPanel`)

- Añadir **botón “Borrar”** (o X) por cada notificación.
- Opcional: **“Borrar todas”** en la cabecera del panel.
- Al borrar:
  - Llamar `POST /api/notifications/delete` con `ids` o `all`.
  - Actualizar estado local (quitar las borradas).
  - Disparar `notifications-updated` con `detail: { deleted: true, deletedIds?, all?, source: 'notifications-panel' }`.
- **Escuchar** `notifications-updated`: al recibirlo, llamar de nuevo a `loadNotifications` (o equivalente) para refrescar la lista. Así, si se borra desde la campanita o desde /dashboard/notificaciones, el panel también se actualiza.

### 3. BORRAR DESDE LA PÁGINA /dashboard/notificaciones

- Añadir **botón “Borrar”** (o X) por cada notificación en la lista.
- Añadir **“Eliminar todas”** / **“Borrar todas las no leídas”** (o similar) en la cabecera.
- Al borrar una o todas:
  - `POST /api/notifications/delete` con `ids` o `all`.
  - Actualizar estado local y disparar `notifications-updated` con `detail: { deleted: true, deletedIds?, all?, source: 'notificaciones-page' }`.
- La página **ya escucha** `notifications-updated`; asegurarse de que, al recibirlo, se refresque la lista (por ejemplo, volver a llamar `load()`).

### 4. SINCRONIZACIÓN EN TODA LA PLATAFORMA

- **Cualquier** componente que muestre notificaciones debe:
  1. **Escuchar** `notifications-updated`.
  2. Al recibirlo (y si no es `detail.source` propio, para evitar bucles): **refrescar** su lista (re-fetch a `/api/notifications/list` o eliminar del estado los `deletedIds`).
- **Cualquier** lugar donde se **borre** debe:
  1. Llamar a `/api/notifications/delete`.
  2. Actualizar su estado local.
  3. Disparar `notifications-updated` con `deleted: true` y `deletedIds` o `all`.

Así, **si se borra en la campanita o en el panel o en la página de notificaciones, las tres zonas se mantienen sincronizadas**.

### 5. DETALLE DEL EVENTO `notifications-updated`

Formato sugerido para **borrado**:

```ts
window.dispatchEvent(new CustomEvent('notifications-updated', {
  detail: {
    deleted: true,
    deletedIds?: string[],   // IDs borrados (cuando se borran una o varias)
    all?: boolean,           // true si se borraron todas las no leídas
    source: 'notification-center' | 'notifications-panel' | 'notificaciones-page',
  },
}));
```

Cada listener puede usar `detail.deletedIds` para quitar solo esas de su estado, o simplemente **recargar** desde la API.

---

## CHECKLIST DE IMPLEMENTACIÓN

- [ ] **NotificationCenter**: botón borrar por notificación + “Eliminar todas”. Llamar a delete API. Disparar `notifications-updated` al borrar. (Ya escucha el evento.)
- [ ] **NotificationsPanel**: botón borrar por notificación (+ opcional “Borrar todas”). Llamar a delete API. Disparar `notifications-updated` al borrar. **Añadir** listener de `notifications-updated` y refrescar lista al recibirlo.
- [ ] **/dashboard/notificaciones**: botón borrar por notificación + “Eliminar todas”. Llamar a delete API. Disparar `notifications-updated` al borrar. Confirmar que el listener existente refresca la lista correctamente.
- [ ] Probar: borrar en campanita → se actualizan panel y página. Borrar en panel → se actualizan campanita y página. Borrar en página → se actualizan campanita y panel.

---

## RESUMEN EN UNA FRASE

**Conectar la campanita, el panel y la página de notificaciones para que todas usen la misma API de listado/borrado y el evento `notifications-updated`, de modo que al borrar en cualquier sitio, las notificaciones se borren y se reflejen en todas las áreas de la plataforma.**
