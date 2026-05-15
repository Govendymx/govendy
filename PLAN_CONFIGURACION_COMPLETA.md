# 📋 Plan de Configuración Completa - Pocket App

Basado en las instrucciones descargadas y el estado actual del proyecto.

## ✅ Ya Ejecutado

1. ✅ `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql` - Sistema de notificaciones y preguntas
2. ✅ `VERIFICAR_ESTADO_FINAL.sql` - Verificación del estado

## 🎯 Próximos Pasos

### Opción 1: Configuración Completa (Recomendado si cambiaste de computadora)

Si cambiaste de computadora y todo se desconfiguró, ejecuta **TODO** el script consolidado:

**Archivo:** `TODOS_LOS_SQL_CONSOLIDADOS.sql`

**Instrucciones:**
1. Abre Supabase → SQL Editor
2. Copia TODO el contenido de `TODOS_LOS_SQL_CONSOLIDADOS.sql`
3. Pega y ejecuta (Ctrl+Enter)
4. Espera a que termine (puede tardar varios minutos)

Este script incluye **TODOS** los scripts en el orden correcto:
- Tablas base (profiles, listings, orders, etc.)
- Sistema de notificaciones
- Triggers y funciones
- Políticas RLS
- Migraciones

### Opción 2: Configuración Esencial (Solo lo básico)

Si solo necesitas lo esencial para que funcione:

**Ejecuta en este orden:**

1. `supabase_profiles_table.sql`
2. `supabase_admin_and_settings.sql`
3. `supabase_admin_user_states.sql`
4. `supabase_listings.sql`
5. `supabase_cart_and_orders.sql`
6. `supabase_payments.sql`
7. `supabase_notifications.sql`
8. `supabase_notifications_enum_extend.sql`
9. `supabase_notifications_triggers.sql`
10. `supabase_listing_questions.sql`
11. `supabase_listing_questions_rls_fix.sql`

## 🔍 Verificación

Después de ejecutar los scripts, verifica:

```sql
-- 1. Verificar tablas principales
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Verificar triggers de notificaciones
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname LIKE '%notify%';

-- 3. Verificar funciones
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%notify%';
```

## ⚠️ Notas Importantes

1. **Idempotencia**: La mayoría de scripts son idempotentes (puedes ejecutarlos varias veces sin problemas)

2. **Permisos de Admin**: Después de ejecutar `supabase_admin_and_settings.sql`, agrega tu usuario como admin:
   ```sql
   INSERT INTO public.admin_users (user_id) 
   VALUES ('tu-uuid-de-usuario-aqui')
   ON CONFLICT (user_id) DO NOTHING;
   ```

3. **Recargar Schema**: Después de ejecutar scripts, recarga el schema:
   ```sql
   SELECT pg_notify('pgrst', 'reload schema');
   ```

## 🚀 Siguiente Paso

**Recomendación:** Ejecuta `TODOS_LOS_SQL_CONSOLIDADOS.sql` para asegurar que TODO esté configurado correctamente.

Después de ejecutarlo, prueba:
1. Responder una pregunta nueva
2. Verificar que la pregunta desaparece
3. Verificar que llega la notificación al comprador
