# Especificación Técnica de Plataforma Marketplace (GoPocket)

Este documento detalla la arquitectura, modelos de datos, reglas de negocio y flujos funcionales de la plataforma **GoPocket**. Está diseñado para servir como referencia técnica para la recreación de sus funcionalidades en otros entornos o para comprensión por sistemas de IA.

---

## 1. Arquitectura Técnica

### Stack Tecnológico
- **Frontend Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS + Framer Motion (animaciones) + Lucide React (iconos)
- **Editor de Texto**: Tiptap (con extensiones de imágenes, tablas, enlaces, etc.)
- **Base de Datos & Auth**: Supabase (PostgreSQL)
- **Almacenamiento**: Supabase Storage + Cloudinary (para optimización de imágenes)
- **Pagos**: MercadoPago SDK
- **Emails**: Nodemailer / Imapflow (SMTP/IMAP)

### Servicios Externos
- **MercadoPago**: Procesamiento de pagos y split payments.
- **Estafeta**: Generación de guías de envío y cotizaciones.
- **Cloudinary**: Hosting y transformación de imágenes de productos.

---

## 2. Modelo de Datos (Schema)

El sistema se basa en una base de datos relacional (PostgreSQL). A continuación se describen las entidades principales y sus relaciones.

### Usuarios y Perfiles (`profiles`)
- **Datos**: ID (UUID), email, nombre, apellido, teléfono, dirección.
- **Configuración**: `plan_type` ('basic' | 'pro'), reputación.
- **Roles**: Usuario estándar, Administrador.

### Publicaciones (`listings`)
El núcleo del marketplace. Soporta venta directa y subastas.
- **Campos Base**: Título, descripción (Rich Text), precio, imágenes (array URLs), stock.
- **Clasificación**: Categoría, género (Mujer/Hombre/Unisex), condición (Nuevo/Usado).
- **Variantes**: Talla (`size`), color (`color`), variantes de stock (`size_stock`).
- **Logística**: Peso (`weight_kg`), dimensiones (`length_cm`, `width_cm`, `height_cm`), `shipping_by_seller` (booleano), `free_shipping` (booleano).
- **Subastas**: `sale_type`='auction', `auction_start_at`, `auction_end_at`, `auction_starting_bid`, `auction_current_bid`.
- **Estado**: `status` (draft, active, sold, paused, blocked).

### Órdenes (`orders`)
Representa una transacción entre un comprador y un vendedor por uno o más ítems.
- **Estados**: `pending_payment`, `paid`, `shipped`, `delivered`, `cancelled`, `disputed`, `refunded`.
- **Financiero**: `subtotal`, `shipping_fee` (costo envío), `commission_fee` (comisión plataforma), `total`.
- **Envío**: `tracking_number`, `shipping_carrier` (ej. Estafeta), `shipping_label_url`, `delivery_proof_url` (para entregas personales).
- **Relaciones**: `buyer_id`, `seller_id`, `payment_method`.

### Pagos (`checkout_sessions` y `wallet`)
- **Checkout**: Agrupa múltiples órdenes en un solo pago.
- **Wallet (Monedero)**: Sistema de saldo interno (`wallets` table).
  - **Transacciones**: `wallet_transactions` (credit/debit) con concepto y referencia.
  - **Uso**: Los usuarios pueden pagar con saldo o recibir reembolsos aquí.

### Disputas (`disputes`)
Sistema de resolución de conflictos.
- **Razones**: No recibido, dañado, no es como se describió.
- **Flujo**: Abierta -> Negociación (Chat de disputa) -> Resolución Admin (Reembolso o Liberación de fondos).

### Comunicación
- **Preguntas (`listing_questions`)**: Q&A público en productos.
- **Chat (`chat_messages`)**: Chat privado post-venta vinculado a una orden.
- **Notificaciones (`notifications`)**: Sistema de alertas en tiempo real.

---

## 3. Reglas de Negocio

### Planes de Vendedor (`Basic` vs `Pro`)
| Característica | Plan Basic | Plan Pro |
| :--- | :--- | :--- |
| **Límite Publicaciones** | 50 activas | Ilimitadas |
| **Comisión Venta** | 23% | 18% |
| **Destacados/Mes** | 3 | 25 |
| **Subastas Activas** | 15 | Ilimitadas |
| **Cupones/Mes** | 25 | Ilimitadas |
| **Retiro de Fondos** | Cada 7 días | Cada 48 horas |
| **Logística Propia** | No (Solo guías plataforma) | Sí (Permite entrega personal/envío propio) |

### Comisiones y Tarifas
1.  **Comisión Plataforma**: Porcentaje sobre el precio del producto (18% o 23% según plan).
2.  **Tarifa Procesamiento Pago (MercadoPago)**:
    - Fija: $4.00 MXN + IVA
    - Variable: 3.49% + IVA
    - Cálculo inverso para asegurar que el vendedor reciba el monto neto esperado o que el comprador cubra el costo (según configuración).

### Lógica de Envíos
- **Integración Estafeta**: Cálculo automático de cotizaciones basado en peso/dimensiones y códigos postales (origen/destino).
- **Envío Gratis**: El vendedor puede absorber el costo del envío (`shipping_subsidy`).
- **Validación de Pérdida**: El sistema impide ofrecer "Envío Gratis" si el precio del producto es menor al costo del envío (balance negativo).

### Subastas
- **Ofertas (`bids`)**: Los usuarios ofertan incrementando el precio actual.
- **Cierre**: Al finalizar el tiempo (`auction_end_at`), se genera automáticamente una orden para el ganador.
- **Reglas**: Incremento mínimo configurado por el vendedor (`auction_bid_increment`).

---

## 4. Funcionalidades Clave

### Editor de Productos (Rich Text)
- Editor avanzado para descripciones.
- Soporte para: Negritas, Listas, Títulos (H1-H3), Color de texto, Tamaño de fuente, Tablas, Emojis.
- Sanitización de HTML (DOMPurify) para seguridad.

### Carrito de Compras
- Soporta múltiples vendedores en un solo carrito.
- **Checkout Split**: Al procesar el pago, el sistema genera órdenes separadas por vendedor pero un solo cobro al usuario.

### Panel de Administración (`/admin`)
- **Gestión de Usuarios**: Ver, bloquear, editar planes.
- **Moderación**: Aprobar/Rechazar publicaciones.
- **Disputas**: Interfaz para leer pruebas y decidir ganadores.
- **Finanzas**: Ver solicitudes de retiro y aprobar transferencias.

### Sistema de Cupones
- **Tipos**: Porcentaje o Monto Fijo.
- **Validación**: Fechas de vigencia, límite de uso, validación de ganancia mínima (para no generar pérdidas al aplicar descuento).

### Monedero "PocketCash"
- Los usuarios pueden recargar saldo (Topups).
- El saldo se usa prioritariamente en el checkout si está disponible.
- Los vendedores reciben sus ganancias aquí antes de solicitar retiro a cuenta bancaria.

---

## 5. Integraciones API

### Endpoints Principales
- `/api/listings/*`: CRUD de productos.
- `/api/checkout/*`: Creación de preferencias de pago MP.
- `/api/webhooks/mercadopago`: Recepción de confirmaciones de pago.
- `/api/estafeta/*`: Cotización y generación de guías.
- `/api/upload`: Subida de imágenes a Cloudinary.

---

## 6. Seguridad y Validaciones
- **RLS (Row Level Security)**: En Supabase para asegurar que los usuarios solo editen su propia data.
- **Middleware**: Protección de rutas `/admin` y rutas autenticadas.
- **Validación de Inputs**: Tipos estrictos en TypeScript y validación en servidor antes de procesar pagos o crear recursos.
