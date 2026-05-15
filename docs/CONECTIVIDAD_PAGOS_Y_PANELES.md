# Conectividad: dinero disponible, pagos y paneles

Objetivo: **una sola fuente de verdad** para montos (disponible, por liberar, estimado) y **sincronización en tiempo real** entre usuario, admin y números en toda la app.

## Fuente de verdad de montos

- **`lib/payouts/calc.ts`**: `payoutNet(o)`, `isReleasedStatus`, `isPaidStatus`, `isCancelledStatus`, `toNumber`, `statusLabel`.
- **`/api/payouts/balance`**: Devuelve `disponible`, `por_liberar`, `estimado`, `can_withdraw` para el vendedor logueado. Usa la misma lógica que retiros y admin.
- **`/api/payouts/withdraw`**, **`/api/payouts/statement`**, **`/api/admin/payouts/report`** y la página **Dashboard → Pagos** usan `lib/payouts/calc` para que los números coincidan en usuario y admin.

## Flujo del dinero

1. **Estimado**: Orden pagada/enviada pero no entregada. El vendedor ve el monto “estimado” en Pagos y en el Dashboard.
2. **Por liberar**: Orden entregada (`delivered`/`completed`) pero el admin aún no ha marcado “pagado al vendedor”. Sigue en **Admin → Métricas** (vista “Por liberar”).
3. **Disponible**: Órdenes con `paid_to_seller_at` (admin marcó pagado), no retiradas ni en disputa. El vendedor puede **Retirar** desde **Dashboard → Pagos** (Mercado Pago).

Cuando el admin marca “Pagado” en Métricas, se actualiza `paid_to_seller_at` en `orders`. Esa actualización se refleja en tiempo real en los paneles del vendedor (véase más abajo).

## Realtime y eventos

- **Dashboard (usuario)**:
  - Suscripción a `orders` con `seller_id = usuario`.
  - Al recibir UPDATE/INSERT, se vuelve a cargar el balance (`/api/payouts/balance`).
  - Escucha el evento `payouts-updated` y vuelve a cargar el balance.
- **Dashboard → Pagos**:
  - Suscripción a `orders` con `seller_id = usuario`.
  - En UPDATE/INSERT se hace refetch de órdenes (y se dispara `payouts-updated` al terminar).
- Así, cuando el admin marca pagado o cambia algo en órdenes, el vendedor ve al instante el dinero disponible y los listados en Pagos actualizados.

## Dónde se muestra el dinero

- **Dashboard**: Tarjeta “Dinero disponible” (usa `/api/payouts/balance`). Enlace a **Pagos**.
- **Dashboard → Pagos**: Resumen (disponible / por liberar / estimado), estado de cuenta y retiro.
- **Admin → Métricas**: Reporte de payouts (liberados / por liberar). Los montos usan `lib/payouts/calc` como el resto.

## Autonomía y paneles

- Los números de **usuario** (Dashboard, Pagos) y **admin** (Métricas, payouts) comparten la misma lógica de cálculo.
- Los cambios en `orders` (p. ej. `paid_to_seller_at`) se propagan vía Realtime y `payouts-updated` a los paneles del vendedor.
- Con esto se mantiene **conexión directa** entre administración de pagos, dinero disponible y experiencia del usuario en toda la app.
