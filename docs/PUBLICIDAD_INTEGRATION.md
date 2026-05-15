# Documentación de Integración: Panel de Publicidad

## Visión General
El panel de publicidad permite a los vendedores destacar sus publicaciones mediante pagos con PocketCash. Esta documentación detalla los puntos de integración, flujos de datos y mecanismos de seguridad implementados.

## Puntos de Integración

### 1. Visualización de Publicaciones (Listings)
- **Endpoint**: `/api/user/listings-featured`
- **Fuente de Datos**: Tablas `listings` y `featured_listings`.
- **Lógica**:
  - Obtiene todas las publicaciones activas del usuario (no eliminadas, no vendidas).
  - Cruza la información con `featured_listings` para mostrar el estado actual de la promoción.
  - **Manejo de Fallos**: Si la tabla `featured_listings` no existe (error de esquema), el sistema degrada la funcionalidad graciosamente, mostrando las publicaciones como "no destacadas" en lugar de fallar.

### 2. Saldo de PocketCash (Wallet)
- **Método**: Consulta Directa Supabase (Cliente).
- **Código**:
  ```typescript
  supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle()
  ```
- **Sincronización**: Se utiliza la misma consulta que el componente `AccountTopMenu` (Header) para garantizar que el saldo mostrado en el panel coincida exactamente con el encabezado.
- **Independencia**: La carga del saldo está desacoplada de la carga de publicaciones mediante `Promise.allSettled`, asegurando que un error en uno no bloquee al otro.

### 3. Proceso de Promoción (Promote)
- **Endpoint**: `/api/featured/promote`
- **Método**: POST
- **Flujo**:
  1. **Validación**: Verifica propiedad de la publicación y parámetros del plan.
  2. **Pre-Chequeo de Sistema**: Verifica la existencia de la tabla `featured_listings` antes de cobrar.
  3. **Cobro (Wallet)**: Deduce el saldo usando `WalletService.deductFunds`.
  4. **Activación**: Inserta el registro en `featured_listings`.
  5. **Manejo de Error Crítico (Reembolso)**: Si la inserción falla (paso 4), el sistema ejecuta automáticamente un **Reembolso** (`WalletService.addFunds`) para devolver el dinero al usuario y evitar inconsistencias financieras.
  6. **Actualización de Estado**: Marca `is_featured = true` en la tabla `listings` para redundancia.
  7. **Notificación**: Envía una notificación unificada al usuario.

## Logs y Monitoreo

El sistema genera los siguientes logs para facilitar el troubleshooting:

- **Advertencias (WARN)**:
  - `Failed to query featured_listings (table might be missing)`: Indica que falta correr la migración SQL.
  - `Error fetching wallet promise`: Problemas de conexión al obtener el saldo.

- **Errores Críticos (ERROR)**:
  - `CRITICAL: Refund failed for user`: **URGENTE**. Indica que falló tanto la activación como el reembolso automático. Requiere intervención manual inmediata.
  - `Error creating featured subscription`: Fallo en la base de datos al registrar la promoción.

## Auditoría de Conexiones
- **Panel Usuario <-> API**: Conexión verificada y protegida con JWT.
- **API <-> Base de Datos**: Uso de `supabaseAdmin` para operaciones privilegiadas (pagos) y `supabase` client para lectura segura.
- **Integridad de Datos**: Se implementaron validaciones para asegurar que solo publicaciones activas y pertenecientes al usuario puedan ser destacadas.

## Migraciones Requeridas
Para el funcionamiento completo, se debe ejecutar el script SQL:
- `supabase_featured_listings.sql`
