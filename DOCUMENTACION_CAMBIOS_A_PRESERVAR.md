# Documentación de Funcionalidades a Preservar (Post-Rollback)

Esta documentación lista los archivos y cambios que deben ser preservados o restaurados después de regresar el código al estado del 9 de febrero, excluyendo los cambios problemáticos del menú SELL (creación de publicaciones).

## 1. GPS / Rastreo de Ubicación (Seguridad)
Sistema de rastreo de ubicación en tiempo real para usuarios y visualización en panel de administración.

*   **Componentes:**
    *   `components/security/LocationTracker.tsx` (Rastreador lado cliente)
    *   `components/admin/LiveMap.tsx` (Mapa en vivo para admin)
*   **Páginas Admin:**
    *   `app/admin/seguridad/page.tsx` (o donde se incluya el mapa)
*   **API:**
    *   `app/api/security/live-users/route.ts` (Endpoint para usuarios activos)
    *   `app/api/user/location/route.ts` (Endpoint para actualizar ubicación)

## 2. Tiendas Oficiales (Official Stores)
Sistema completo de gestión y visualización de tiendas oficiales.

*   **Admin Panel:**
    *   `app/admin/tiendas-oficiales/page.tsx` (Gestión de tiendas)
*   **Frontend:**
    *   `components/home/OfficialStoresCarousel.tsx` (Carrusel en home)
    *   `app/tienda/[sellerId]/page.tsx` (Perfil de vendedor actualizado con soporte oficial)
*   **API:**
    *   `app/api/official-stores/route.ts`
    *   `app/api/sellers/[id]/route.ts` (Actualizado para devolver datos de tienda oficial)

## 3. Configuración de Negocio (Cashback)
Panel para configurar cashback global y por tienda.

*   **Admin Panel:**
    *   `app/admin/negocio/page.tsx`
*   **Base de Datos:**
    *   Tabla `app_settings` (columnas: `cashback_enabled`, `cashback_percent`, etc.) - Se actualiza directamente desde el cliente.

## 4. Edición de Publicaciones
Funcionalidad para que los usuarios editen sus publicaciones existentes.

*   **Página:**
    *   `app/dashboard/listings/[id]/edit/page.tsx`
*   **Componente Principal:**
    *   `components/listings/ListingForm.tsx`
        *   *Nota:* Este componente maneja tanto creación como edición. Si se revierte, se perderá la capacidad de edición. Se recomienda mantener la versión actual o integrar la lógica de `mode="edit"`.
*   **API:**
    *   `app/api/listings/update/route.ts`

## 5. Unificación de Tarjetas de Producto (Listing Cards)
Mejora visual y consistencia en la visualización de productos en toda la plataforma.

*   **Componente Base:**
    *   `components/listings/ListingCard.tsx` (Versión unificada con soporte para subastas, ofertas, etc.)
*   **Páginas Actualizadas:**
    *   `app/page.tsx` (Home)
    *   `app/subastas/page.tsx` (Subastas - ahora usa ListingCard con timer)
    *   `app/listings/ListingsClient.tsx` (Resultados de búsqueda)
    *   `app/tienda/[sellerId]/page.tsx` (Tienda de vendedor)
    *   `app/mas-vistos/page.tsx`
    *   `app/productos-destacados/page.tsx`
    *   `app/envio-gratis/page.tsx`
    *   `app/dashboard/favoritos/page.tsx`

## 6. Categorías Inteligentes
Selector de categorías con autocompletado y propuesta de nuevas categorías.

*   **Componente:**
    *   `components/listings/SmartCategorySelector.tsx`
*   **Librería:**
    *   `lib/categories.ts` (Configuración de categorías)

## 7. Panel de Usuarios Pro
Gestión de usuarios con suscripción Pro.

*   **Admin Panel:**
    *   `app/admin/usuarios-pro/page.tsx`
*   **API:**
    *   `app/api/pro-users/route.ts` (o similar)

## 8. Nombres en Paneles
Mejoras en la visualización de nombres de usuario/tienda en diversos paneles.

*   **Archivos Afectados:**
    *   `app/dashboard/layout.tsx` (o `template.tsx` / `page.tsx` principal del dashboard)
    *   Headers y Sidebars donde se implementó la lógica de visualización de nombre.

---

### Instrucciones para el Rollback
1.  Realizar el rollback al commit del 9 de febrero.
2.  Copiar/Restaurar los archivos listados arriba desde una copia de seguridad o rama actual.
3.  **Excluir** cualquier restauración de:
    *   `app/listings/create/page.tsx`
    *   `app/api/listings/create/route.ts`
    *   `app/api/listings/create-v2/route.ts`
    *   (Estos archivos deben permanecer en su versión estable del 9 de febrero o ser reconstruidos sin los bugs recientes).
