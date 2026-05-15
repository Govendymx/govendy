# Orden de Ejecución de Scripts SQL de Supabase

Este documento indica el orden recomendado para ejecutar los scripts SQL en Supabase SQL Editor.

## 📋 Scripts Base (Ejecutar primero)

### 1. `supabase_profiles_table.sql`
**Descripción:** Crea la tabla de perfiles de usuario y configura RLS básico.
**Por qué primero:** Es fundamental para que los usuarios puedan tener perfiles.

### 2. `supabase_admin_and_settings.sql`
**Descripción:** Crea la tabla de administradores y configuración global de la app.
**Por qué segundo:** Necesario para el panel de administrador y configuración de pagos.

### 3. `supabase_admin_user_states.sql`
**Descripción:** Crea la tabla para gestionar estados de usuarios (activo/suspendido/bloqueado).
**Por qué tercero:** Necesario para la funcionalidad de administración de usuarios.

## 📦 Scripts de Funcionalidades Core

### 4. `supabase_listings.sql`
**Descripción:** Crea la tabla de productos/listings.
**Dependencias:** Requiere `profiles` (usuarios).

### 5. `supabase_cart_and_orders.sql`
**Descripción:** Crea las tablas de carrito y órdenes.
**Dependencias:** Requiere `listings` y `profiles`.

### 6. `supabase_payments.sql`
**Descripción:** Crea la tabla de pagos.
**Dependencias:** Requiere `orders`.

## 🔧 Scripts de Migración/Mejoras (Ejecutar después)

### 7. `supabase_profiles_ine_migration.sql`
**Descripción:** Agrega campos de INE a perfiles si no están.
**Dependencias:** Requiere `profiles`.

### 8. `supabase_profiles_address_migration.sql`
**Descripción:** Migración de direcciones en perfiles.
**Dependencias:** Requiere `profiles`.

### 9. `supabase_profiles_reputation.sql`
**Descripción:** Agrega sistema de reputación a perfiles.
**Dependencias:** Requiere `profiles`.

### 10. `supabase_listings_public_id.sql`
**Descripción:** Agrega IDs públicos a listings.
**Dependencias:** Requiere `listings`.

### 11. `supabase_listings_soft_delete.sql`
**Descripción:** Agrega eliminación suave a listings.
**Dependencias:** Requiere `listings`.

### 12. `supabase_listings_lifecycle.sql`
**Descripción:** Agrega estados de ciclo de vida a listings.
**Dependencias:** Requiere `listings`.

### 13. `supabase_listings_rls_fix.sql`
**Descripción:** Corrige políticas RLS de listings.
**Dependencias:** Requiere `listings`.

### 14. `supabase_orders_logistics.sql`
**Descripción:** Agrega campos de logística a órdenes.
**Dependencias:** Requiere `orders`.

### 15. `supabase_orders_paid_to_seller.sql`
**Descripción:** Agrega tracking de pagos a vendedores.
**Dependencias:** Requiere `orders`.

### 16. `supabase_shipping_features.sql`
**Descripción:** Agrega envío gratis y conteo de compartidos.
**Dependencias:** Requiere `listings` y `orders`.

## 💬 Scripts de Comunicación

### 17. `supabase_order_chat.sql`
**Descripción:** Crea sistema de chat para órdenes.
**Dependencias:** Requiere `orders`.

### 18. `supabase_order_chat_reads.sql`
**Descripción:** Agrega tracking de mensajes leídos.
**Dependencias:** Requiere `order_chat`.

### 19. `supabase_order_chat_upgrade.sql`
**Descripción:** Mejoras al sistema de chat.
**Dependencias:** Requiere `order_chat`.

## 🔔 Scripts de Notificaciones

### 20. `supabase_notifications.sql`
**Descripción:** Crea sistema de notificaciones.
**Dependencias:** Requiere `profiles`.

### 21. `supabase_notifications_enum_extend.sql`
**Descripción:** Extiende tipos de notificaciones.
**Dependencias:** Requiere `notifications`.

### 22. `supabase_notifications_triggers.sql`
**Descripción:** Crea triggers para notificaciones automáticas.
**Dependencias:** Requiere `notifications` y otras tablas relacionadas.

### 23. `supabase_notifications_backfill.sql`
**Descripción:** Backfill de notificaciones existentes (opcional).
**Dependencias:** Requiere `notifications`.

## ⭐ Scripts de Reputación y Reseñas

### 24. `supabase_user_ratings.sql`
**Descripción:** Crea sistema de calificaciones.
**Dependencias:** Requiere `profiles` y `orders`.

### 25. `supabase_user_reviews_public.sql`
**Descripción:** Crea reseñas públicas de usuarios.
**Dependencias:** Requiere `profiles`.

## 🎁 Scripts Adicionales

### 26. `supabase_favorites.sql`
**Descripción:** Crea sistema de favoritos.
**Dependencias:** Requiere `listings` y `profiles`.

### 27. `supabase_listing_questions.sql`
**Descripción:** Crea sistema de preguntas en listings.
**Dependencias:** Requiere `listings`.

### 28. `supabase_listing_templates.sql`
**Descripción:** Crea sistema de plantillas para listings.
**Dependencias:** Requiere `listings`.

### 29. `supabase_auctions_and_coupons.sql`
**Descripción:** Crea sistema de subastas y cupones.
**Dependencias:** Requiere `listings` y `orders`.

### 30. `supabase_home_banners.sql`
**Descripción:** Crea sistema de banners en home.
**Dependencias:** Requiere `admin_users` (función `is_admin()`).

### 31. `supabase_home_banners_placements.sql`
**Descripción:** Agrega placements a banners.
**Dependencias:** Requiere `home_banners`.

### 32. `supabase_home_banners_admin_delete.sql`
**Descripción:** Permisos de eliminación para admins en banners.
**Dependencias:** Requiere `home_banners`.

### 33. `supabase_disputes.sql`
**Descripción:** Crea sistema de disputas.
**Dependencias:** Requiere `orders`.

### 34. `supabase_support_chat.sql`
**Descripción:** Crea sistema de chat de soporte.
**Dependencias:** Requiere `profiles`.

### 35. `supabase_contacts_table.sql`
**Descripción:** Crea tabla de contactos.
**Dependencias:** Requiere `profiles`.

### 36. `supabase_checkout_sessions_offline.sql`
**Descripción:** Crea sesiones de checkout offline.
**Dependencias:** Requiere `orders`.

### 37. `supabase_checkout_sessions_offline_proof.sql`
**Descripción:** Agrega comprobantes de pago offline.
**Dependencias:** Requiere `checkout_sessions_offline`.

### 38. `supabase_profiles_payout_migration.sql`
**Descripción:** Migración de payouts en perfiles.
**Dependencias:** Requiere `profiles`.

### 39. `supabase_storage_policies_pocket.sql`
**Descripción:** Configura políticas de almacenamiento.
**Dependencias:** Ninguna específica.

## ⚠️ Notas Importantes

1. **Ejecuta en orden:** Algunos scripts dependen de otros, así que sigue el orden indicado.

2. **Idempotencia:** La mayoría de scripts usan `CREATE TABLE IF NOT EXISTS` y `DROP POLICY IF EXISTS`, por lo que puedes ejecutarlos múltiples veces sin problemas.

3. **Permisos de Admin:** Después de ejecutar `supabase_admin_and_settings.sql`, necesitas agregar manualmente tu usuario como admin:
   ```sql
   INSERT INTO public.admin_users (user_id) 
   VALUES ('tu-uuid-de-usuario-aqui');
   ```

4. **Variables de entorno:** Asegúrate de tener configurado `SUPABASE_SERVICE_ROLE_KEY` en tu `.env.local` para que funcione el panel de administrador.

5. **RLS (Row Level Security):** Todos los scripts habilitan RLS por seguridad. Asegúrate de entender las políticas antes de modificar.

## 🚀 Orden Rápido (Solo lo esencial)

Si solo necesitas lo básico para empezar:

1. `supabase_profiles_table.sql`
2. `supabase_admin_and_settings.sql`
3. `supabase_admin_user_states.sql`
4. `supabase_listings.sql`
5. `supabase_cart_and_orders.sql`
6. `supabase_payments.sql`

Estos 6 scripts te darán la funcionalidad básica de la aplicación.
