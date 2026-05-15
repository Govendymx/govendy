# Orden de Ejecución: Funciones SQL Atómicas

## 📋 Orden Correcto de Ejecución

Ejecuta estos scripts en Supabase SQL Editor **en este orden exacto**:

### Paso 1: Verificación y Preparación ⚠️ OBLIGATORIO

**Archivo:** `supabase_verify_functions.sql`

**Qué hace:**
- ✅ Verifica y crea columnas faltantes en `disputes` (return_guide_url, return_tracking, return_guide_cost, return_guide_charged_to)
- ✅ Verifica y crea columna `paid_at` en `orders` (si no existe)
- ✅ Verifica y crea columna `paid_confirmed_by_name` en `checkout_sessions` (si no existe)
- ✅ Verifica y crea función helper `is_admin()` (si no existe)
- ✅ Muestra resumen de verificación

**Ejecutar primero:** Este script es seguro ejecutarlo múltiples veces (idempotente).

### Paso 2: Función para Resolver Disputas

**Archivo:** `supabase_disputes_resolve_atomic.sql`

**Qué hace:**
- ✅ Crea función `resolve_dispute_atomic()` para resolver disputas de forma atómica
- ✅ Actualiza `disputes` y `orders` en una sola transacción
- ✅ Maneja columnas opcionales de forma segura
- ✅ Rollback automático si algo falla

**Ejecutar después de:** `supabase_verify_functions.sql`

### Paso 3: Función para Actualizar Pagos Offline

**Archivo:** `supabase_checkout_sessions_update_atomic.sql`

**Qué hace:**
- ✅ Crea función `update_checkout_session_atomic()` para actualizar pagos offline de forma atómica
- ✅ Actualiza `checkout_sessions` y `orders` en una sola transacción
- ✅ Maneja arrays de `order_ids` de forma segura
- ✅ Maneja columna `paid_at` opcional
- ✅ Rollback automático si algo falla

**Ejecutar después de:** `supabase_verify_functions.sql`

## 🔍 Verificación Post-Ejecución

Después de ejecutar todos los scripts, verifica que las funciones se crearon correctamente:

```sql
-- Verificar que las funciones existen
SELECT 
  proname as funcion,
  pronargs as parametros,
  prorettype::regtype as tipo_retorno
FROM pg_proc 
WHERE proname IN ('resolve_dispute_atomic', 'update_checkout_session_atomic')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;
```

**Resultado esperado:**
- `resolve_dispute_atomic` - 9 parámetros - jsonb
- `update_checkout_session_atomic` - 4 parámetros - jsonb

## 🐛 Solución de Problemas

### Error: "column does not exist"

**Causa:** Las columnas necesarias no existen en la base de datos.

**Solución:** Ejecuta `supabase_verify_functions.sql` primero. Este script crea todas las columnas faltantes.

### Error: "function already exists"

**Causa:** Las funciones ya fueron creadas anteriormente.

**Solución:** No es un error. Las funciones se recrean con `CREATE OR REPLACE FUNCTION`, así que puedes ejecutarlas de nuevo sin problema.

### Error: "permission denied"

**Causa:** No tienes permisos para crear funciones.

**Solución:** Asegúrate de estar usando una cuenta con permisos de administrador en Supabase.

### Error: "syntax error"

**Causa:** Puede haber un problema con la versión de PostgreSQL o la sintaxis.

**Solución:** 
1. Verifica que estás usando PostgreSQL 12 o superior
2. Copia y pega el script completo (no solo una parte)
3. Ejecuta el script en Supabase SQL Editor (no en otro cliente)

## 📝 Notas Importantes

1. **Orden es crítico:** Ejecuta `supabase_verify_functions.sql` primero para asegurar que todas las columnas existan.

2. **Idempotencia:** Todos los scripts son idempotentes (puedes ejecutarlos múltiples veces sin problemas).

3. **Seguridad:** Las funciones usan `SECURITY DEFINER`, lo que significa que se ejecutan con los permisos del creador, no del llamador.

4. **Manejo de errores:** Las funciones manejan columnas opcionales de forma segura usando bloques `BEGIN...EXCEPTION`.

5. **Rollback automático:** Si algo falla, las funciones revierten todos los cambios automáticamente.

## ✅ Checklist de Ejecución

- [ ] Ejecuté `supabase_verify_functions.sql` y vi el mensaje "VERIFICACIÓN COMPLETA"
- [ ] Ejecuté `supabase_disputes_resolve_atomic.sql` sin errores
- [ ] Ejecuté `supabase_checkout_sessions_update_atomic.sql` sin errores
- [ ] Verifiqué que las funciones existen (usando la consulta de verificación)
- [ ] Probé resolver una disputa desde el panel de admin
- [ ] Probé marcar un pago offline como pagado desde el panel de admin

## 🚀 Uso de las Funciones

### Resolver Disputa

```sql
SELECT public.resolve_dispute_atomic(
  p_dispute_id := 'uuid-de-disputa',
  p_admin_id := 'uuid-de-admin',
  p_decision := 'release',
  p_admin_note := 'Nota opcional'
);
```

### Actualizar Pago Offline

```sql
SELECT public.update_checkout_session_atomic(
  p_checkout_id := 'uuid-de-sesion',
  p_admin_id := 'uuid-de-admin',
  p_action := 'mark_paid',
  p_admin_name := 'Nombre Admin'
);
```

## 📊 Resultados Esperados

### resolve_dispute_atomic

**Éxito:**
```json
{
  "success": true,
  "dispute_id": "uuid",
  "order_id": "uuid",
  "dispute_status": "resolved",
  "order_status": "paid"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Mensaje de error descriptivo"
}
```

### update_checkout_session_atomic

**Éxito:**
```json
{
  "success": true,
  "checkout_id": "uuid",
  "status": "paid",
  "updated_orders": 1,
  "order_ids": ["uuid1", "uuid2"]
}
```

**Error:**
```json
{
  "success": false,
  "error": "Mensaje de error descriptivo"
}
```
