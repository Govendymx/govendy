# Diagnóstico: Pagos Offline No Aparecen en Panel de Admin

## 🔍 Problema Reportado

- Se realizaron 2 compras con pago fuera de línea
- No se acreditan
- No aparecen en el panel de administrador en la sección de pagos

## 📋 Pasos de Diagnóstico

### Paso 1: Verificar Esquema de Base de Datos

Ejecuta en Supabase SQL Editor: `supabase_verify_offline_payments.sql`

Este script verifica:
- ✅ Que todas las columnas necesarias existen en `checkout_sessions`
- ✅ Cuántas sesiones offline hay en la base de datos
- ✅ Últimas 5 sesiones offline creadas
- ✅ Órdenes con payment_method offline
- ✅ Órdenes huérfanas (sin sesión de checkout)

### Paso 2: Revisar Logs

**Frontend (Consola del Navegador):**
- Abre la consola (F12) antes de hacer una compra
- Busca logs que empiecen con `[CHECKOUT]`
- Verifica que se llame a `/api/offline-payment/create`
- Verifica que se reciba un `checkoutId` válido

**Backend (Vercel Logs):**
- Ve a Vercel → Tu proyecto → Logs
- Busca logs que empiecen con:
  - `[OFFLINE PAYMENT CREATE]` - Creación de sesión
  - `[ADMIN OFFLINE LIST]` - Listado en panel de admin
  - `[CHECKOUT]` - Creación de órdenes

### Paso 3: Verificar Flujo Completo

1. **Creación de Órdenes:**
   - ¿Se crean las órdenes correctamente?
   - ¿Tienen `payment_method` = 'bank_transfer', 'bank_deposit' o 'oxxo'?
   - ¿Tienen `status` = 'pending_payment'?

2. **Creación de Sesión:**
   - ¿Se llama a `/api/offline-payment/create`?
   - ¿Se crea la sesión en `checkout_sessions`?
   - ¿Tiene `order_ids` correctamente configurado?

3. **Listado en Admin:**
   - ¿El panel de admin llama a `/api/admin/payments/offline/list`?
   - ¿La query encuentra las sesiones?
   - ¿Hay algún error en la respuesta?

## 🐛 Problemas Comunes y Soluciones

### Problema 1: Las órdenes se crean pero no la sesión

**Síntomas:**
- Las órdenes aparecen en la base de datos
- No hay sesión en `checkout_sessions`
- El usuario no puede ver la hoja de pago

**Causas posibles:**
- Error al llamar a `/api/offline-payment/create`
- Error al insertar en `checkout_sessions`
- Falta de columnas en `checkout_sessions`

**Solución:**
1. Revisa los logs de `[OFFLINE PAYMENT CREATE]`
2. Ejecuta `supabase_checkout_sessions_offline.sql` si faltan columnas
3. Verifica que `order_ids` sea un array UUID[]

### Problema 2: La sesión se crea pero no aparece en admin

**Síntomas:**
- La sesión existe en `checkout_sessions`
- No aparece en el panel de admin
- El listado devuelve 0 sesiones

**Causas posibles:**
- Filtro de `payment_method` incorrecto
- Filtro de `status` muy restrictivo
- Error en la query de listado

**Solución:**
1. Revisa los logs de `[ADMIN OFFLINE LIST]`
2. Verifica que `payment_method` sea exactamente 'bank_transfer', 'bank_deposit' o 'oxxo'
3. Prueba listar sin filtro de status

### Problema 3: Órdenes huérfanas (sin sesión)

**Síntomas:**
- Las órdenes existen pero no tienen sesión
- Aparecen como "virtual" en el panel de admin

**Causa:**
- La sesión no se creó después de crear las órdenes
- Error en el flujo de checkout

**Solución:**
- El panel de admin ya detecta órdenes huérfanas y las muestra como "virtual"
- Puedes marcarlas como pagadas y se creará la sesión automáticamente

## 🔧 Scripts SQL de Verificación

### Verificar Sesiones Offline

```sql
SELECT 
  id,
  payment_method,
  status,
  amount,
  reference_code,
  created_at,
  array_length(order_ids, 1) as order_ids_count
FROM public.checkout_sessions
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
ORDER BY created_at DESC
LIMIT 20;
```

### Verificar Órdenes Offline

```sql
SELECT 
  id,
  payment_method,
  status,
  total,
  created_at
FROM public.orders
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
ORDER BY created_at DESC
LIMIT 20;
```

### Verificar Órdenes Sin Sesión

```sql
SELECT 
  o.id,
  o.payment_method,
  o.status,
  o.total,
  o.created_at
FROM public.orders o
WHERE o.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
  AND o.status IN ('pending_payment', 'pending')
  AND NOT EXISTS (
    SELECT 1 
    FROM public.checkout_sessions cs
    WHERE cs.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
      AND o.id = ANY(cs.order_ids)
  )
ORDER BY o.created_at DESC;
```

## 📊 Logs Esperados

### Al Crear Pago Offline

**Frontend:**
```
[CHECKOUT] Creando sesión de pago offline... { orderIds: [...], paymentMethod: 'bank_transfer' }
[CHECKOUT] Respuesta de offline-payment/create: { status: 200, ok: true }
[CHECKOUT] ✅ Sesión offline creada exitosamente: { checkoutId: '...', reference_code: '...' }
```

**Backend:**
```
[OFFLINE PAYMENT CREATE] Verificando si ya existe sesión para estas órdenes...
[OFFLINE PAYMENT CREATE] Creando nueva sesión...
[OFFLINE PAYMENT CREATE] ✅ Sesión creada exitosamente: { checkoutId: '...', reference_code: '...', orderIds: [...] }
[OFFLINE PAYMENT CREATE] ✅ Verificación exitosa: { checkoutId: '...', status: 'pending', ... }
```

### Al Listar en Admin

**Backend:**
```
[ADMIN OFFLINE LIST] Iniciando carga de pagos offline... { status: '', limit: 80 }
[ADMIN OFFLINE LIST] Total sesiones offline en BD: X
[ADMIN OFFLINE LIST] Sesiones encontradas: X { total_in_db: X, filtered_by_status: 'ninguno', ... }
[ADMIN OFFLINE LIST] Órdenes huérfanas encontradas: X
[ADMIN OFFLINE LIST] Total sesiones enriquecidas: X (X reales, X virtuales)
```

## ✅ Checklist de Verificación

- [ ] Ejecuté `supabase_verify_offline_payments.sql` y revisé los resultados
- [ ] Revisé los logs del frontend al hacer una compra
- [ ] Revisé los logs del backend en Vercel
- [ ] Verifiqué que las órdenes se crean con `payment_method` offline
- [ ] Verifiqué que la sesión se crea en `checkout_sessions`
- [ ] Verifiqué que el panel de admin llama a `/api/admin/payments/offline/list`
- [ ] Verifiqué que la query encuentra las sesiones

## 🚀 Próximos Pasos

1. **Haz una compra de prueba** con pago offline
2. **Revisa los logs** en consola y Vercel
3. **Ejecuta el script SQL** de verificación
4. **Comparte los resultados** para diagnóstico más específico
