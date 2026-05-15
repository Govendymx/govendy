# Documentación de Flujo de Datos y Notificaciones

Este documento describe la arquitectura de notificaciones y logs de actividad implementada para conectar las operaciones del cliente con el panel de administración.

## Arquitectura General

El sistema utiliza un enfoque centralizado de logs (`activity_logs`) donde eventos críticos del lado del cliente y del servidor son registrados. El panel de administración consume estos logs para mostrar un "Feed de Actividad" en tiempo real.

### Componentes Principales

1.  **Tabla `activity_logs`**: Almacena todos los eventos.
    *   Columnas clave: `event_type`, `entity_type`, `entity_id`, `severity`, `details`, `user_id`, `created_at`.
2.  **Utilidad `logActivity`** (`lib/admin/activity-logger.ts`): Función helper para insertar logs de forma consistente. Incluye fallback a `console.log` si la base de datos falla.
3.  **Endpoint de Logs** (`app/api/admin/activity-logs/route.ts`): API que expone los logs recientes al frontend del admin.
4.  **Componente `ActivityFeed`** (`app/admin/components/ActivityFeed.tsx`): Componente de UI que hace polling al endpoint de logs y muestra las alertas.

## Flujos de Datos Específicos

### 1. Cotización de Envíos (Estafeta)
*   **Origen**: Usuario hace clic en "Cotizar" en el checkout.
*   **Ruta**: `/api/estafeta/calculate`
*   **Log Exitoso**: `event_type: 'quote_created'`, `severity: 'info'`. Detalle incluye costo y peso.
*   **Log Error**: `event_type: 'quote_failed_error'`, `severity: 'error'`. Detalle incluye mensaje de error.
*   **Visualización**: Aparece en el feed con ícono de camión 🚚. Si es error, aparece en rojo 🚨.

### 2. Pagos MercadoPago (Webhooks)
*   **Origen**: MercadoPago notifica un pago aprobado.
*   **Ruta**: `/api/mercadopago/webhook`
*   **Log**: `event_type: 'payment_approved'`, `severity: 'info'`. Detalle incluye monto y IDs de órdenes.
*   **Visualización**: Aparece en el feed con ícono de dinero 💰.

### 3. Subida de Comprobantes (Pagos Offline)
*   **Origen**: Usuario sube foto del ticket de depósito.
*   **Ruta**: `/api/offline-payment/proof`
*   **Log**: `event_type: 'payment_proof_uploaded'`, `severity: 'warning'`.
*   **Visualización**: Aparece como alerta amarilla ⚠️ en el feed.
*   **Acción Admin**: El admin puede ir a "Pagos Offline" para aprobar o rechazar.

### 4. Aprobación/Rechazo Manual
*   **Origen**: Admin hace clic en "Acreditar" o "Rechazar" en `/admin/pagos`.
*   **Ruta**: `/api/admin/payments/offline/update`
*   **Log**: `event_type: 'payment_mark_paid'` o `'payment_cancel'`.
*   **Visualización**: Confirma la acción en el feed.

## Mantenimiento y Extensión

Para agregar nuevos eventos:
1.  Importar `logActivity` desde `@/lib/admin/activity-logger`.
2.  Llamar a `await logActivity({...})` en el punto crítico del código.
3.  (Opcional) Actualizar `ActivityFeed.tsx` si se requiere un ícono o formato especial para el nuevo `event_type`.

## Seguridad

*   Los endpoints de administración (`/api/admin/*`) están protegidos por middleware y RLS para asegurar que solo usuarios con rol de admin puedan acceder.
*   El endpoint de logs filtra información sensible si fuera necesario (actualmente devuelve detalles completos para el admin).
