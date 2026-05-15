# 📋 Plan de Acción Basado en CURSOR_AGENT_GUIDE.md

## ✅ Estado Actual

Ya ejecutado:
- ✅ `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql` (cubre notificaciones y preguntas)

## 🎯 Scripts SQL Pendientes Según el Manual

Según `CURSOR_AGENT_GUIDE.md`, estos son los scripts críticos que deben ejecutarse:

### Scripts de Notificaciones (Ya cubiertos por CONFIGURACION_COMPLETA)
1. ✅ `supabase_notifications.sql` - Ya incluido
2. ✅ `supabase_notifications_enum_extend.sql` - Ya incluido  
3. ✅ `supabase_notifications_triggers.sql` - Ya incluido

### Scripts Pendientes (Según el Manual)

4. ⚠️ **`supabase_support_chat.sql`**
   - Crea tablas y funciones para chat de soporte
   - **Verificar**: `SELECT * FROM support_conversations LIMIT 1;`

5. ⚠️ **`supabase_disputes.sql`**
   - Crea sistema de disputas
   - **Verificar**: `SELECT * FROM disputes LIMIT 1;`

6. ⚠️ **`supabase_profiles_payout_migration.sql`**
   - Agrega campos de pago a vendedores en `profiles`
   - **Verificar**: `SELECT payout_bank_name, payout_clabe FROM profiles LIMIT 1;`

7. ⚠️ **`supabase_orders_paid_to_seller.sql`**
   - Agrega tracking de pagos a vendedores en `orders`
   - **Verificar**: `SELECT paid_to_seller_at FROM orders LIMIT 1;`

## 🚀 Opciones de Ejecución

### Opción 1: Ejecutar Scripts Individuales (Recomendado)

Ejecuta estos 4 scripts en orden en Supabase → SQL Editor:

1. `supabase_support_chat.sql`
2. `supabase_disputes.sql`
3. `supabase_profiles_payout_migration.sql`
4. `supabase_orders_paid_to_seller.sql`

### Opción 2: Ejecutar Todo el Consolidado

Si prefieres asegurar que TODO esté configurado:

**Ejecutar:** `TODOS_LOS_SQL_CONSOLIDADOS.sql`

Este archivo incluye todos los scripts en el orden correcto.

## 🔍 Verificación Después de Ejecutar

```sql
-- 1. Verificar tablas de soporte
SELECT * FROM support_conversations LIMIT 1;
SELECT * FROM support_messages LIMIT 1;

-- 2. Verificar tablas de disputas
SELECT * FROM disputes LIMIT 1;
SELECT * FROM dispute_messages LIMIT 1;

-- 3. Verificar campos de payout en profiles
SELECT payout_bank_name, payout_clabe FROM profiles LIMIT 1;

-- 4. Verificar campos de payout en orders
SELECT paid_to_seller_at, paid_to_seller_by FROM orders LIMIT 1;

-- 5. Recargar schema
SELECT pg_notify('pgrst', 'reload schema');
```

## 📝 Próximos Pasos

1. **Ejecutar los 4 scripts pendientes** (o el consolidado completo)
2. **Verificar que las tablas existen** usando las queries de arriba
3. **Probar funcionalidades**:
   - Chat de soporte
   - Sistema de disputas
   - Pagos a vendedores
4. **Probar notificaciones de preguntas**:
   - Responder una pregunta nueva
   - Verificar que desaparece
   - Verificar que llega la notificación al comprador

## ⚠️ Nota Importante

El manual menciona que el orden es crítico. Si ejecutas `TODOS_LOS_SQL_CONSOLIDADOS.sql`, ya incluye todo en el orden correcto y es idempotente (puedes ejecutarlo varias veces sin problemas).
