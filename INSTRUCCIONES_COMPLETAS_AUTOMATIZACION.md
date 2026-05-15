# 🚀 Instrucciones Completas: Sistema de Automatización y Seguridad

## ✅ Estado de Implementación

Todas las fases han sido implementadas:

- ✅ **Fase 1**: Validación y Seguridad de Pagos
- ✅ **Fase 2**: Sistema de Notificaciones Dual (Panel + Email)
- ✅ **Fase 3**: Control Administrativo Completo
- ✅ **Fase 4**: Jobs Automáticos y Cron
- ✅ **Fase 5**: Dashboard de Salud del Sistema

---

## 📋 Paso 1: Ejecutar Scripts SQL

### 1.1 Script Maestro (Recomendado)

Ejecuta el script completo que incluye todas las tablas:

```sql
-- En Supabase SQL Editor, ejecuta:
EJECUTAR_TODOS_SQL_INTEGRACION_ADMIN.sql
```

Este script crea:
- ✅ Tabla `admin_operation_events` (eventos de operaciones)
- ✅ Funciones atómicas (`resolve_dispute_atomic`, `update_checkout_session_atomic`)
- ✅ Tabla `admin_action_logs` (logs de acciones admin)
- ✅ Tabla `payment_logs` (logs de pagos)

### 1.2 Verificación

Después de ejecutar, deberías ver:
- `tabla_eventos_creada: 1`
- `tabla_admin_logs_creada: 1`
- `tabla_payment_logs_creada: 1`
- `funcion_is_admin: 1`
- `funcion_resolve_dispute: 1`
- `funcion_update_checkout: 1`

---

## 🔧 Paso 2: Configurar Variables de Entorno

### 2.1 En Vercel

Agrega estas variables en **Vercel → Settings → Environment Variables**:

```bash
# Para cron jobs (opcional pero recomendado)
CRON_SECRET=tu_secret_super_seguro_aqui

# Ya deberías tener estas:
MERCADOPAGO_ACCESS_TOKEN=tu_token
MERCADOPAGO_WEBHOOK_SECRET=tu_secret
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 2.2 Configurar Vercel Cron (Opcional)

Crea un archivo `vercel.json` en la raíz del proyecto:

```json
{
  "crons": [
    {
      "path": "/api/cron/jobs?secret=TU_CRON_SECRET",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

O configura directamente en Vercel Dashboard → Cron Jobs

---

## 🎯 Paso 3: Usar las Nuevas Funcionalidades

### 3.1 Validación de Pagos

```typescript
import { validatePayment } from '@/lib/payments/validation';

const validation = await validatePayment(admin, {
  buyerId: 'user-id',
  amount: 1000,
  paymentMethod: 'mercadopago',
  checkoutId: 'checkout-id',
  orderIds: ['order-id-1'],
});

if (!validation.valid) {
  console.error('Errores:', validation.errors);
  console.warn('Advertencias:', validation.warnings);
  return;
}

// Proceder con el pago
```

### 3.2 Notificaciones Unificadas

```typescript
import { sendUnifiedNotification } from '@/lib/notifications/unified';

await sendUnifiedNotification(admin, {
  userId: 'user-id',
  type: 'payment_approved',
  title: 'Pago Acreditado',
  body: 'Tu pago fue acreditado exitosamente',
  channels: ['both'], // 'panel' | 'email' | 'both'
  linkTo: '/dashboard/compras',
  priority: 'high',
});
```

### 3.3 Gestión de Usuarios

```typescript
import { executeUserAction } from '@/lib/admin/userManagement';

// Suspender usuario por 7 días
const result = await executeUserAction(admin, adminId, userId, 'suspend', {
  days: 7,
  notes: 'Violación de términos de servicio',
});

if (result.ok) {
  console.log(`Usuario suspendido. ${result.affectedListings} publicaciones pausadas.`);
}

// Banear usuario
const banResult = await executeUserAction(admin, adminId, userId, 'ban', {
  notes: 'Actividad fraudulenta',
});

// Eliminar usuario (IRREVERSIBLE)
const deleteResult = await executeUserAction(admin, adminId, userId, 'delete', {
  notes: 'Solicitud del usuario',
});
```

### 3.4 Logging de Pagos

```typescript
import { logPaymentError, logPaymentSuccess } from '@/lib/payments/logging';

// En caso de error
await logPaymentError({
  payment_id: 'payment-id',
  external_reference: 'checkout-id',
  stage: 'validation',
  error: 'Monto inválido',
});

// En caso de éxito
await logPaymentSuccess({
  payment_id: 'payment-id',
  external_reference: 'checkout-id',
  stage: 'processing',
});
```

---

## 📊 Paso 4: Acceder al Dashboard de Salud

1. Ve a `/admin/salud` en tu aplicación
2. Verás métricas en tiempo real:
   - Estado de pagos (últimas 24h)
   - Notificaciones enviadas
   - Estado de usuarios
   - Estado de órdenes
   - Errores recientes

El dashboard se actualiza automáticamente cada 30 segundos.

---

## 🔄 Paso 5: Configurar Jobs Automáticos

### 5.1 Ejecución Manual (Testing)

Puedes probar los jobs manualmente:

```bash
# Con secret configurado
curl https://tu-app.vercel.app/api/cron/jobs?secret=TU_CRON_SECRET

# Sin secret (solo desarrollo)
curl https://tu-app.vercel.app/api/cron/jobs
```

### 5.2 Jobs Incluidos

Los jobs automáticos ejecutan:

1. **Verificación de suspensiones expiradas**
   - Reactiva usuarios cuya suspensión expiró
   - Reactiva publicaciones pausadas
   - Notifica a usuarios

2. **Limpieza de sesiones expiradas**
   - Cancela sesiones de checkout pendientes de más de 7 días

3. **Recordatorios de pagos**
   - Envía recordatorios para pagos offline pendientes de más de 2 días

4. **Actualización de estados de órdenes**
   - Marca como entregadas las órdenes enviadas hace más de 14 días

5. **Limpieza de logs antiguos**
   - Elimina logs de pagos de más de 90 días
   - Elimina logs de acciones admin de más de 180 días

---

## 🛡️ Seguridad Implementada

### Validaciones de Pagos

- ✅ Validación de usuarios (activos, suspendidos, baneados)
- ✅ Validación de órdenes (propiedad, estados, montos)
- ✅ Prevención de pagos duplicados
- ✅ Validación de límites ($100,000 MXN máximo)
- ✅ Detección de disputas abiertas

### Control Administrativo

- ✅ Validación de permisos (no se puede modificar a otros admins)
- ✅ Validación de órdenes activas antes de eliminar usuarios
- ✅ Logging completo de todas las acciones
- ✅ Notificaciones automáticas a usuarios afectados

### Logging y Auditoría

- ✅ Logs de todos los pagos (éxitos y errores)
- ✅ Logs de todas las acciones administrativas
- ✅ Logs de eventos de operaciones
- ✅ Índices optimizados para consultas rápidas

---

## 📧 Notificaciones

### Canales Disponibles

- **Panel**: Notificaciones en el panel de usuario
- **Email**: Emails automáticos con plantillas profesionales
- **Ambos**: Envío simultáneo a panel y email

### Plantillas de Email

Plantillas incluidas:
- `payment_approved` - Pago acreditado
- `payment_rejected` - Pago rechazado
- `order_shipped` - Pedido enviado

Fácil de extender agregando más plantillas en `lib/email/templates.ts`.

---

## 🎨 Dashboard de Salud

### Métricas Mostradas

- **Pagos**: Estado, cantidad, tasa de error
- **Notificaciones**: Cantidad enviada
- **Usuarios**: Activos, suspendidos, baneados
- **Órdenes**: Pendientes, pagadas, enviadas
- **Errores Recientes**: Últimos 10 errores con detalles

### Estados de Salud

- 🟢 **Healthy**: Todo funcionando correctamente
- 🟡 **Warning**: Algunos problemas menores
- 🔴 **Critical**: Problemas críticos que requieren atención

---

## 📝 Archivos Creados

### Backend

- `lib/payments/validation.ts` - Validación de pagos
- `lib/payments/logging.ts` - Logging de pagos
- `lib/notifications/unified.ts` - Notificaciones unificadas
- `lib/notifications/email.ts` - Envío de emails
- `lib/email/templates.ts` - Plantillas de email
- `lib/admin/userManagement.ts` - Gestión de usuarios
- `lib/automation/jobs.ts` - Jobs automáticos

### APIs

- `app/api/cron/jobs/route.ts` - Endpoint de cron jobs
- `app/api/admin/health/route.ts` - API de salud del sistema

### Frontend

- `app/admin/salud/page.tsx` - Dashboard de salud

### SQL

- `supabase_payment_logs.sql` - Tabla de logs de pagos
- `supabase_admin_action_logs.sql` - Tabla de logs de acciones
- `EJECUTAR_TODOS_SQL_INTEGRACION_ADMIN.sql` - Script maestro

---

## 🚨 Solución de Problemas

### Error: "relation payment_logs does not exist"

**Solución**: Ejecuta `EJECUTAR_TODOS_SQL_INTEGRACION_ADMIN.sql` en Supabase

### Error: "CRON_SECRET no configurado"

**Solución**: Agrega `CRON_SECRET` en Vercel Environment Variables (opcional para desarrollo)

### Los jobs no se ejecutan automáticamente

**Solución**: Configura Vercel Cron Jobs o ejecuta manualmente desde `/api/cron/jobs`

### Las notificaciones por email no llegan

**Solución**: Verifica que `RESEND_API_KEY` esté configurado en Vercel

### El dashboard de salud muestra errores

**Solución**: Verifica que las tablas SQL estén creadas y que `SUPABASE_SERVICE_ROLE_KEY` esté configurado

---

## ✅ Checklist Final

- [ ] Ejecutado `EJECUTAR_TODOS_SQL_INTEGRACION_ADMIN.sql` en Supabase
- [ ] Verificadas las tablas creadas (admin_operation_events, payment_logs, admin_action_logs)
- [ ] Configurado `CRON_SECRET` en Vercel (opcional)
- [ ] Configurado Vercel Cron Jobs (opcional)
- [ ] Probado dashboard de salud en `/admin/salud`
- [ ] Probado jobs automáticos manualmente
- [ ] Verificado que las notificaciones funcionan (panel y email)

---

## 🎯 Próximos Pasos Recomendados

1. **Integrar validaciones en webhook de MercadoPago**
   - Agregar `validatePayment()` antes de procesar
   - Agregar logging en cada etapa

2. **Usar notificaciones unificadas en todo el sistema**
   - Reemplazar llamadas directas a `insertNotificationBestEffort`
   - Usar `sendUnifiedNotification()` para notificaciones importantes

3. **Configurar alertas automáticas**
   - Alertas cuando la tasa de error de pagos supera el 10%
   - Alertas cuando hay muchos usuarios suspendidos
   - Alertas cuando hay errores críticos

4. **Monitorear logs regularmente**
   - Revisar `payment_logs` para errores recurrentes
   - Revisar `admin_action_logs` para auditoría
   - Revisar `admin_operation_events` para tracking

---

## 📚 Documentación Adicional

- `RESUMEN_IMPLEMENTACION_AUTOMATIZACION.md` - Resumen técnico
- `VERIFICAR_CONEXION_PANEL_ADMIN.md` - Verificación de conexión
- `INSTRUCCIONES_EJECUTAR_EVENTOS_ADMIN.md` - Instrucciones de eventos

---

**¡El sistema está completamente automatizado y listo para producción!** 🚀
