# Instrucciones: Ejecutar Sistema de Eventos para Panel de Admin

## 📋 Pasos de Ejecución

### Paso 1: Crear Tabla de Eventos en Supabase

1. **Abre Supabase SQL Editor:**
   - Ve a tu proyecto en Supabase
   - Haz clic en "SQL Editor" en el menú lateral

2. **Ejecuta el script SQL:**
   - Abre el archivo `supabase_admin_operation_events.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en "Run" o presiona Ctrl+Enter

3. **Verifica que se creó correctamente:**
   - Deberías ver un mensaje de éxito
   - La última query del script mostrará un resumen de verificación

### Paso 2: Verificar que Funciona

1. **Haz una compra de prueba:**
   - Agrega productos al carrito
   - Completa el checkout (puede ser pago offline)

2. **Verifica en Supabase:**
   - Ve a Table Editor → `admin_operation_events`
   - Deberías ver un evento con `event_type = 'order_created'`

3. **Verifica en Panel de Admin:**
   - Ve a `/admin`
   - Deberías ver contadores de "Eventos hoy" y "Eventos urgentes"
   - Ve a `/admin/supervision` para ver las operaciones

## ✅ Lo que se ha Implementado

### Fase 1: Infraestructura Base ✅
- ✅ Tabla `admin_operation_events` creada
- ✅ Función `recordAdminEvent()` en `lib/admin/events.ts`
- ✅ Función `notifyAllAdmins()` ya existía en `lib/notifications/admin.ts`
- ✅ API `/api/admin/events` para listar eventos

### Fase 2: Integración en Operaciones Críticas ✅
- ✅ **Creación de órdenes** (`/api/checkout/create`)
  - Registra evento `order_created`
  - Notifica a admins si es orden de alto valor o pago offline

- ✅ **Pagos offline** (`/api/offline-payment/create` y `/api/admin/payments/offline/update`)
  - Registra evento `payment_offline_created` al crear sesión
  - Registra evento `payment_offline_confirmed` al confirmar pago
  - Notifica a admins sobre pagos pendientes

- ✅ **Disputas** (`/api/disputes/open` y `/api/admin/disputes/resolve`)
  - Registra evento `dispute_opened` al abrir disputa
  - Registra evento `dispute_resolved` al resolver disputa
  - Notifica a admins sobre nuevas disputas

### Fase 3: Dashboard Mejorado ✅
- ✅ API `/api/admin/dashboard/summary` actualizada con conteo de eventos
- ✅ Dashboard principal (`/admin`) muestra contadores de eventos
- ✅ Indicadores de eventos urgentes y pendientes

## 🔄 Próximos Pasos (Opcional)

### Fase 3: Panel de Eventos (Pendiente)
- [ ] Crear página `/admin/eventos` para ver todos los eventos
- [ ] Implementar filtros y búsqueda
- [ ] Implementar actualización en tiempo real con Supabase Realtime

### Fase 4: Integración en Más Operaciones (Pendiente)
- [ ] Integrar en envíos y logística
- [ ] Integrar en publicaciones
- [ ] Integrar en usuarios
- [ ] Integrar en soporte
- [ ] Integrar en Estafeta

## 🐛 Solución de Problemas

### Error: "relation admin_operation_events does not exist"
**Solución:** Ejecuta `supabase_admin_operation_events.sql` en Supabase SQL Editor

### Error: "permission denied"
**Solución:** Asegúrate de estar usando una cuenta con permisos de administrador en Supabase

### Los eventos no aparecen
**Solución:**
1. Verifica que la tabla se creó correctamente
2. Revisa los logs de Vercel para ver si hay errores al registrar eventos
3. Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurado en Vercel

### Los contadores muestran 0
**Solución:**
1. Haz una compra de prueba para generar eventos
2. Espera unos segundos y refresca el panel de admin
3. Verifica en Supabase Table Editor que los eventos se están creando

## 📊 Verificación SQL

Ejecuta esto en Supabase SQL Editor para verificar:

```sql
-- Verificar que la tabla existe
SELECT COUNT(*) as total_eventos FROM public.admin_operation_events;

-- Ver últimos 10 eventos
SELECT 
  event_type,
  entity_type,
  entity_id,
  status,
  created_at
FROM public.admin_operation_events
ORDER BY created_at DESC
LIMIT 10;

-- Contar eventos por tipo
SELECT 
  event_type,
  COUNT(*) as total
FROM public.admin_operation_events
GROUP BY event_type
ORDER BY total DESC;
```

## 🎯 Resultado Esperado

Después de ejecutar el SQL y hacer una compra de prueba:

1. **En Supabase:**
   - Tabla `admin_operation_events` con eventos registrados
   - Eventos con `event_type = 'order_created'`, `payment_offline_created`, etc.

2. **En Panel de Admin (`/admin`):**
   - Contador "Eventos hoy" muestra el número de eventos del día
   - Contador "Eventos urgentes" muestra eventos de alta prioridad
   - Los eventos se reflejan en tiempo real

3. **En Panel de Supervisión (`/admin/supervision`):**
   - Todas las operaciones aparecen correctamente
   - Las operaciones nuevas se muestran inmediatamente

## 📝 Notas Importantes

- Los eventos se registran de forma "best-effort" - no interrumpen operaciones principales si fallan
- Los eventos se registran automáticamente cuando ocurren operaciones
- El sistema de notificaciones ya existía y se está usando para notificar a admins
- Todos los eventos incluyen metadata con información relevante
