# Análisis de arquitectura y prioridades MVP — Pocket (Marketplace C2C)

**Rol:** Senior Full-Stack Product Engineer & UX Strategist  
**Objetivo:** Resumen de arquitectura detectada y **3 puntos más críticos** para acercarse a un MVP profesional tipo Mercado Libre / GoTrendier.

---

## 1. Resumen de la arquitectura actual

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS |
| **Backend** | Next.js API Routes (`/api/*`), Supabase (Postgres, Auth, Storage) |
| **Pagos** | MercadoPago SDK (preference + webhook) + pago offline (transferencia, depósito, OXXO) |
| **Media** | Supabase Storage + opcional Cloudinary (watermark en `lib/cloudinary`) |
| **Auth** | Supabase Auth (PKCE, JWT); API Routes validan `Authorization: Bearer` |

### Modelo de datos (tablas relevantes)

- **`listings`** — Publicaciones (seller_id, title, price, images, status, sale_type, auction_*, category, etc.).
- **`cart_items`** — Carrito por usuario (user_id, listing_id, quantity); UNIQUE (user_id, listing_id).
- **`orders`** — Órdenes por comprador/vendedor (buyer_id, seller_id, status, payment_method, subtotal, shipping_fee, total, shipping_*).
- **`order_items`** — Líneas de cada orden (order_id, listing_id, title, unit_price, quantity, line_total).
- **`profiles`** — Perfil de usuario (full_name, phone, dirección completa, INE, reputation_score, etc.).
- **`checkout_sessions`** — Sesiones de checkout (buyer_id, order_ids, payment_method, status, amount, mp_*, reference_code para offline).
- **`favorites`** — Favoritos (user_id, listing_id).
- **`listing_questions`** — Preguntas al vendedor (no comentarios públicos).
- **`home_banners`**, **`app_settings`**, **`notifications`**, **`disputes`**, **`support`**, **`coupons`**, **`templates`**, etc.

### Flujos principales

1. **Checkout (online)**  
   Carrito → `/checkout` → `POST /api/checkout/create` (órdenes por vendedor, cupón, dirección) →  
   `POST /api/mercadopago/preference` (crea `checkout_sessions`, preferencia MP) → redirección a MP →  
   Webhook `POST /api/mercadopago/webhook` actualiza `checkout_sessions` y `orders` → éxito/fallo vía back_urls a `/dashboard`.

2. **Checkout (offline)**  
   Mismo `create` → `POST /api/offline-payment/create` → hoja de pago con `reference_code` →  
   `/pago/[checkoutId]` (PDF, instrucciones, subida de comprobante).

3. **Publicar**  
   `/sell` → upload vía `/api/upload` (Supabase/Cloudinary) → templates de descripción →  
   `POST /api/listings/create` o `update`. Moderación de contenido (`lib/moderation/listingContentPolicy`).

4. **Detalle de listing**  
   `/listings/[id]` — Agregar al carrito, favoritos, preguntas, “más del vendedor”, subastas (pujas), cupón.

### Seguridad

- **RLS** en `listings`, `cart_items`, `orders`, `order_items`, `profiles`, `favorites`, `checkout_sessions`.
- APIs sensibles validan JWT (Bearer). Checkout y precios se calculan **siempre en servidor**.
- Webhook MP: autorización opcional vía `MERCADOPAGO_WEBHOOK_SECRET` en query.
- Upload: buckets por tipo (`identificaciones`, `upload`), auth requerida.

### UX / producto

- **Mobile-first** implícito (Tailwind responsive), carruseles en home, banners configurables.
- Estética pink/brand, gradients, cards estilo marketplace.
- Favoritos en dashboard y detalle de listing; en **Home los botones de favorito en cards no tienen `onClick`** (solo `aria-label`).
- **Social commerce:** hay favoritos y preguntas; **no** hay “seguir vendedores” ni likes separados ni comentarios públicos.

---

## 2. Debilidades y riesgos detectados

- **Checkout:** Se vacía el carrito **antes** de que el usuario complete el pago en MP (tras crear la preferencia). Si cierra o abandona, pierde el carrito.
- **Dirección:** Perfil exige muchos campos (calle, ext, int, colonia, CP, estado, ciudad, referencias, entre calles). Alta fricción en onboarding y checkout.
- **Post-pago:** `back_urls` de MP llevan a `/dashboard` genérico; no hay página de “¡Gracias por tu compra!” ni mensaje claro de éxito/error.
- **Webhook MP:** Sin validación de firma oficial de MercadoPago; solo token por query.
- **Migraciones SQL:** Múltiples archivos (`listings`, `cart_and_orders`, `payments`, `checkout_sessions_offline`, etc.) y fallbacks en código por columnas faltantes (`seller_id` vs `user_id`). Riesgo de esquema inconsistente entre entornos.
- **Listings:** No hay `stock`/cantidad; es 1 unidad por publicación. Filtros en `/listings` básicos (búsqueda `q`, sin facetas avanzadas).

---

## 3. Los 3 puntos más críticos para el MVP

Estos tres bloques, resueltos bien, acercan más el producto a un **MVP profesional** (conversion-oriented, seguro, confiable).

---

### 1. Checkout de extremo a extremo y CRO (Conversión)

**Qué hay hoy:** Flujo completo MP + offline, órdenes por vendedor, cupones, dirección snapshot. Fricciones: dirección muy estricta, carrito se vacía antes de pagar, feedback post-pago pobre.

**Qué hacer:**

1. **Reducir fricción en dirección**  
   - Diferenciar campos **obligatorios** (nombre, teléfono, calle, número, colonia, CP, ciudad, estado) de **opcionales** (referencias, entre calles, int).  
   - Permitir checkout solo con obligatorios; opcionales editables después si se necesita.

2. **No vaciar el carrito hasta confirmar pago**  
   - Vaciar solo cuando el webhook marque `status === 'approved'` (o el equivalente en tu flujo).  
   - O, como mínimo, no borrar `cart_items` al redirigir a MP; hacerlo solo en “success” o al detectar sesión ya pagada. Así se evita perder el carrito si el usuario abandona.

3. **Página de éxito y de error post-pago**  
   - `back_urls.success` → `/compra-exitosa?checkoutId=...` (o similar) con mensaje claro, resumen de pedido y CTA a “Ver mis compras” / “Seguir comprando”.  
   - `failure` / `pending` → página específica con mensaje y opción de reintentar o contactar soporte.

4. **Webhook más seguro**  
   - Usar si está disponible la **verificación de firma** de MercadoPago (headers `x-signature`, `x-request-id`), no solo un token por query.  
   - Mantener idempotencia (evitar duplicar actualizaciones de órdenes en reintentos).

**Impacto:** Menos abandonos, más confianza, menos soporte por “no sé si pagué” o “perdí mi carrito”.

---

### 2. Inventario / publicación y disponibilidad

**Qué hay hoy:** Carga de fotos (Supabase/Cloudinary), templates, categoría/talla/color, venta directa y subasta. Sin stock, sin reservas.

**Qué hacer:**

1. **Definir modelo de stock para el MVP**  
   - Si todo es “1 unidad por publicación”, dejarlo explícito y **validar en checkout** que el listing siga `active` y no vendido.  
   - Si quieres multi-unidad: añadir `quantity` (o `stock`) a `listings`, descontar en checkout y validar `quantity >= 0` antes de crear órdenes.

2. **Carga de fotos rápida y clara**  
   - Progreso de subida (por archivo o global).  
   - Límites claros (ej. “2–6 fotos”, “máx. 5 MB c/u”).  
   - Opcional: recorte básico o sugerencia de “mejor foto” como portada.

3. **Categorización y filtros mínimos**  
   - En `/listings`: filtros por **categoría**, **rango de precio** y **orden** (más recientes, precio menor/mayor).  
   - Aunque sea con dropdowns simples, esto mejora descubrimiento y sensación de “marketplace serio”.

4. **Validación de disponibilidad en checkout**  
   - En `POST /api/checkout/create`: revalidar que cada `listing` siga `active` y, si aplica, que `quantity` sea suficiente.  
   - Si algo ya no está disponible, devolver error claro (“X ya no está disponible”) y no crear órdenes.

**Impacto:** Menos ventas rotas por ítems agotados o mal publicados, y mejor experiencia al publicar y buscar.

---

### 3. Social commerce y confianza (favoritos, reputación, básico)

**Qué hay hoy:** `favorites`, preguntas al vendedor, reputación y badges en perfil. Favoritos funcionan en detalle y en dashboard; en **Home no**.

**Qué hacer:**

1. **Favoritos consistentes en toda la app**  
   - Conectar el botón de favorito en **Home** (y en cualquier card de listing) con la misma lógica que en `/listings/[id]`:  
     - Si no hay sesión → abrir login/modal y, tras login, guardar favorito.  
     - Si hay sesión → toggle en `favorites` y feedback visual (relleno de corazón, toast “Agregado a favoritos”).  
   - Reutilizar un pequeño hook o componente `useFavorites` / `FavoriteButton` para evitar duplicar lógica.

2. **Reputación visible donde importa**  
   - En **detalle de listing**: mostrar badge y rating del vendedor (ya se obtiene de `/api/sellers/[id]`).  
   - En **perfil público** `/perfil/[id]` o **tienda** `/tienda/[sellerId]`: térmometro de reputación y últimas reseñas.  
   - Asegurar que `ReputationThermometer` y `ReviewsList` se usen en esas vistas.

3. **“Seguir vendedores” (MVP mínimo)**  
   - Si el tiempo lo permite: tabla `follows` (user_id, seller_id) y en `/tienda/[sellerId]` un botón “Seguir”.  
   - Para el MVP podría ser solo “Más de este vendedor” (ya existe) y dejar “feed de seguidos” para una siguiente iteración.

**Impacto:** Más engagement, más uso de favoritos, más confianza en comprar a desconocidos. Base sólida para luego añadir feed, notificaciones de vendedores seguidos, etc.

---

## 4. Hoja de ruta sugerida (orden de ejecución)

| Fase | Acciones |
|------|----------|
| **1. Checkout y CRO** | Dirección flexible, no vaciar carrito pre-pago, páginas éxito/error, endurecer webhook. |
| **2. Inventario y listados** | Stock explícito (o “1 unidad”) + validación en checkout; filtros básicos en `/listings`; UX de subida de fotos. |
| **3. Social y confianza** | Favoritos en Home (y todas las cards), reputación visible en listing y tienda/perfil; opcional “Seguir vendedor”. |

Después de esto, priorizar según métricas: **pasarelas adicionales**, **emails transaccionales**, **SEO en listados**, **avanzar en logística** (envíos, etiquetas), etc.

---

## 5. Referencias rápidas en el código

- **Checkout:** `app/checkout/page.tsx`, `app/api/checkout/create/route.ts`, `app/api/mercadopago/preference/route.ts`, `app/api/mercadopago/webhook/route.ts`, `app/pago/[checkoutId]/page.tsx`
- **Carrito:** `app/cart/page.tsx`, `app/listings/[id]/page.tsx` (`addToCart`), políticas RLS en `supabase_cart_and_orders.sql`
- **Listings y sell:** `app/sell/page.tsx`, `app/api/listings/create|update|clone`, `app/api/upload/route.ts`, `lib/cloudinary/utils.ts`
- **Favoritos:** `app/dashboard/favoritos/page.tsx`, `app/listings/[id]/page.tsx` (isFav, toggle), `supabase_favorites.sql`
- **Reputación:** `app/api/reputation/[id]`, `app/api/sellers/[id]`, `components/reputation/`, `app/perfil/[id]`, `app/tienda/[sellerId]`
- **Schemas de pago:** `supabase_payments.sql`, `supabase_checkout_sessions_offline.sql`, `supabase_checkout_sessions_offline_proof.sql`

---

*Documento generado a partir del análisis del codebase actual. Ajustar prioridades según negocio y capacidad del equipo.*
