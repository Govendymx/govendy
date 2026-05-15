export const PLATFORM_KNOWLEDGE_BASE = `
[BASE DE CONOCIMIENTO COMPLETA — GOPOCKET PLATFORM]

════════════════════════════════════════════════════════
SECCIÓN 1: PLANES DE MEMBRESÍA
════════════════════════════════════════════════════════

PLAN BASIC (plan_type = 'basic' o NULL):
  - Comisión por venta: 23% sobre el precio del producto
  - Publicaciones activas: máximo 50
  - Subastas activas: máximo 15
  - Retiros: disponibles 168 horas (7 días) después de la venta
  - Envío: Solo guías prepagadas de GoVendy (Estafeta/FedEx)
  - Envío por cuenta propia: NO permitido
  - Entrega personal: NO disponible por defecto

PLAN PRO (plan_type = 'pro'):
  - Comisión por venta: 18% sobre el precio del producto
  - Publicaciones activas: ILIMITADAS
  - Subastas activas: ILIMITADAS
  - Retiros: disponibles 48 horas después de la venta
  - Envío por cuenta propia: SÍ permitido (shipping_by_seller = true)
  - Entrega personal: SÍ disponible (allow_personal_delivery = true)
  - Opción de ofrecer envío gratis al comprador (lo absorbe el vendedor)

PLAN PLATINUM (plan_type = 'platinum'):
  - Mismos beneficios que PRO más beneficios premium adicionales
  - Retiros: disponibles 24 horas después de la venta
  - Acceso a GoVendy Live, estadísticas avanzadas

PLAN MEMBER_PRO (plan_type = 'member_pro'):
  - Plan especial de comprador premium
  - No aplica comisiones de venta (no es plan vendedor)

════════════════════════════════════════════════════════
SECCIÓN 2: COMISIONES — CÓMO SE CALCULAN
════════════════════════════════════════════════════════

FÓRMULA BÁSICA:
  subtotal = precio_producto × cantidad
  comisión = subtotal × (tasa_comisión / 100)
  neto_vendedor = subtotal - comisión
  (El costo de envío NO entra al cálculo de comisión)

TASAS POR PLAN:
  - BASIC: 23%
  - PRO / PLATINUM: 18%
  - Si plan_type es NULL → asumir BASIC (23%)

EJEMPLO CORRECTO (BASIC):
  Producto: $500 → Comisión: $115 (23%) → Neto vendedor: $385
  (Si hay envío GoVendy de $175 cobrado al comprador → ese dinero va a la plataforma, no al vendedor)

SEÑALES DE ANOMALÍA EN COMISIONES:
  ⚠️ Si comisión < 18% del subtotal → subcobro sospechoso
  ⚠️ Si comisión > 25% del subtotal → sobrecobro sospechoso
  ⚠️ Si neto_vendedor + comisión ≠ subtotal → error de cálculo

════════════════════════════════════════════════════════
SECCIÓN 3: ENVÍOS Y LOGÍSTICA — REGLAS COMPLETAS
════════════════════════════════════════════════════════

TIPOS DE ENVÍO (shipping modes):

A) ENVÍO GOPOCKET (shipping_by_seller = false, free_shipping = false):
   - La plataforma gestiona la guía (Estafeta o FedEx)
   - Costo calculado por peso/volumen y tarifas Estafeta
   - El comprador paga el costo de envío
   - CHIP en producto: "ENVÍO GOPOCKET"
   - CHIP en producto si free_shipping = true: "ENVÍO GOPOCKET · GRATIS"

B) ENVÍO GRATIS / FREE SHIPPING (free_shipping = true):
   - La plataforma absorbe el costo de envío
   - Comprador paga $0 de envío
   - CHIP en producto: "ENVÍO GOPOCKET · GRATIS"

C) ENVÍO GESTIONADO POR VENDEDOR (shipping_by_seller = true):
   - Solo disponible para plan PRO o PLATINUM
   - El vendedor pone su propio precio de envío (shipping_price)
   - El comprador paga ese precio exacto, SIN markup de la plataforma
   - CHIP en producto: "ENVÍO POR VENDEDOR" o "ENVÍO GRATIS POR VENDEDOR" si shipping_price = 0
   - En checkout: aparece opción "Envío Gestionado por el Vendedor" con el precio del vendedor
   - NUNCA debe aparecer "Envío Estándar" de GoVendy si shipping_by_seller = true

D) ENTREGA PERSONAL (allow_personal_delivery = true):
   - Solo disponible para plan PRO o PLATINUM
   - Costo para el comprador: $0 (GRATIS)
   - CHIP en producto: "ENTREGA PERSONAL"
   - Puede coexistir con envío por vendedor (ambos chips pueden mostrarse)

E) PRODUCTO DIGITAL (product_type = 'digital'):
   - Shipping_fee SIEMPRE = $0
   - No requiere dirección de envío
   - CHIP en producto: "PRODUCTO DIGITAL"
   - NUNCA debe mostrar chips de envío físico
   - En checkout: no mostrar opciones de envío, mostrar $0

REGLAS DE CHIPS (lo que DEBE aparecer según configuración):
  product_type = 'digital'                    → Solo chip "PRODUCTO DIGITAL"
  free_shipping = true, !shipping_by_seller   → Chip "ENVÍO GOPOCKET · GRATIS"
  shipping_by_seller = true, !free_shipping   → Chip "ENVÍO POR VENDEDOR"
  shipping_by_seller = true, free_shipping    → Chip "ENVÍO GRATIS POR VENDEDOR"  
  allow_personal_delivery = true              → Chip "ENTREGA PERSONAL" (adicional)
  Ninguno de los anteriores                   → Chip "ENVÍO GOPOCKET" (default)

TARIFAS ESTAFETA (referencia):
  0-1 kg:   ~$168 base (comprador paga con markup)
  1-5 kg:   ~$170
  5-10 kg:  ~$225
  10-15 kg: ~$240
  15-20 kg: ~$260
  20-25 kg: ~$275
  25-30 kg: ~$295
  30-35 kg: ~$295
  35-40 kg: ~$310
  40-45 kg: ~$385
  45-50 kg: ~$435
  50-55 kg: ~$465
  55-60 kg: ~$485
  
  PESO VOLUMÉTRICO: (largo_cm × ancho_cm × alto_cm) / 5000 kg
  SE COBRA EL MAYOR entre peso físico y volumétrico.
  MARKUP de plataforma: configurable (shipping_markup_fixed + shipping_markup_percent sobre base)

SEÑALES DE ANOMALÍA EN ENVÍOS:
  ⚠️ Producto digital con shipping_fee > 0 → ERROR, debe ser $0
  ⚠️ Envío por vendedor con plan BASIC → NO PERMITIDO
  ⚠️ Monto de envío cobrado ≠ shipping_price del listing (cuando shipping_by_seller=true) → ERROR
  ⚠️ Chip "ENVÍO GOPOCKET" mostrado en producto de entrega personal exclusiva → ERROR
  ⚠️ Envío estándar de $195 cuando vendedor gestiona su envío → ERROR

════════════════════════════════════════════════════════
SECCIÓN 4: SUBASTAS
════════════════════════════════════════════════════════

  - Duración: 1 hora a 7 días (configurable al crear)
  - Una vez iniciada: NO se puede cancelar, pausar ni eliminar
  - Incremento mínimo de puja: auction_bid_increment (default 1)
  - Al finalizar: genera orden "pending_payment" al ganador
  - El ganador pide ir a checkout para pagar envío + producto
  - Si nadie puja → la subasta expira sin venta

SEÑALES DE ANOMALÍA EN SUBASTAS:
  ⚠️ Subasta con estado 'active' pero auction_end_at en el pasado → Debe haberse cerrado
  ⚠️ Orden de subasta sin auction_highest_bidder_id → Error
  ⚠️ Precio de orden de subasta menor a precio base del listing → Posible error de sistema

════════════════════════════════════════════════════════
SECCIÓN 5: ÓRDENES Y ESTADOS
════════════════════════════════════════════════════════

CICLO DE VIDA DE UNA ORDEN:
  pending_payment → paid → shipped → delivered → completed
                                               ↘ disputed
                        ↘ cancelled

ESTADOS:
  pending_payment: Creada, pago no confirmado. Fondos NO retenidos aún.
  paid:            Pago confirmado. Fondos retenidos. Vendedor puede generar guía.
  shipped:         Guía generada/enviado. Fondos siguen retenidos.
  delivered:       Comprador confirmó recepción o sistema la marcó.
  completed:       Fondos liberados al vendedor (credited a su wallet).
  cancelled:       Cancelada. Reembolso procesado si fue paid.
  disputed:        En reclamación activa. Fondos congelados.

CAMPOS IMPORTANTES DE ORDEN:
  orders.total         = subtotal + shipping_fee (lo que paga el comprador)
  orders.shipping_fee  = costo de envío cobrado
  orders.commission    = comisión de la plataforma
  orders.seller_net    = lo que recibe el vendedor (total - commission - shipping_fee_platform)
  orders.shipping_carrier = 'gopocket' | 'seller' | 'pickup' | 'digital'
  orders.shipping_option_id = 'standard' | 'pickup' | 'seller_managed' | [carrier_id]

VERIFICACIÓN DE INTEGRIDAD DE ORDEN:
  ✅ CORRECTO: total = subtotal + shipping_fee
  ✅ CORRECTO: commission ≈ subtotal × tasa_plan (±1 peso por redondeo)
  ✅ CORRECTO: seller_net = subtotal - commission
  ✅ CORRECTO: Si product_type='digital', shipping_fee debe ser 0
  ✅ CORRECTO: Si shipping_by_seller=true y plan es pro/platinum, shipping_fee = listing.shipping_price
  
  ⚠️ ANOMALÍA: total ≠ subtotal + shipping_fee → cálculo incorrecto
  ⚠️ ANOMALÍA: commission ≠ subtotal × tasa → comisión mal aplicada
  ⚠️ ANOMALÍA: seller_net negativo → el vendedor pierde dinero, posible error
  ⚠️ ANOMALÍA: Producto digital con shipping_fee > 0 → cobro indebido de envío
  ⚠️ ANOMALÍA: Orden 'completed' sin wallet_transaction de crédito → fondos no liberados

════════════════════════════════════════════════════════
SECCIÓN 6: PAGOS Y RETIROS
════════════════════════════════════════════════════════

MÉTODOS DE PAGO:
  - MercadoPago: Tarjeta débito/crédito, OXXO, transferencia
  - PocketCash: Saldo interno del monedero digital
  - Depósito bancario: Manual, requiere confirmación admin
  - Transferencia SPEI: Manual, requiere confirmación admin

RETIROS (seller_withdrawals):
  estados: 'pending' | 'approved' | 'rejected' | 'completed'
  - Se solicita desde el panel del vendedor
  - Admin revisa y aprueba/rechaza
  - El monto se debita del wallet del vendedor

TIEMPOS DE DISPONIBILIDAD DE FONDOS:
  - BASIC: 168h (7 días) desde que la orden se marca como 'completed'
  - PRO: 48h desde completed
  - PLATINUM: 24h desde completed

SEÑALES DE ANOMALÍA EN PAGOS/RETIROS:
  ⚠️ Retiro solicitado mayor al saldo disponible del wallet → Posible fraude
  ⚠️ Orden 'paid' con referencia de pago offline sin aprobación admin → Revisar
  ⚠️ Wallet con saldo negativo → Error grave de sistema (nunca debe ocurrir)
  ⚠️ Múltiples retiros en el mismo día de la misma cuenta por montos similares → Revisar

════════════════════════════════════════════════════════
SECCIÓN 7: USUARIOS Y CUENTAS
════════════════════════════════════════════════════════

CAMPOS CLAVE EN PROFILES:
  plan_type:          'basic' | 'pro' | 'platinum' | 'member_pro' | null
  is_seller:          true/false
  is_verified:        verificación de identidad
  is_official_store:  tienda oficial verificada
  reputation_score:   0-100 (calculado automáticamente)
  rating_good_count:  reseñas positivas
  rating_total_count: total de reseñas

SEÑALES DE RIESGO EN USUARIOS:
  ⚠️ Cuenta creada hoy con muchas órdenes → Posible fraude
  ⚠️ Vendedor con plan BASIC usando shipping_by_seller → Configuración inválida
  ⚠️ Reputación < 50% con más de 10 ventas → Vendedor de alto riesgo
  ⚠️ Comprador y vendedor siendo la misma persona en una orden → Auto-compra (fraude)
  ⚠️ Múltiples cuentas con el mismo email/IP → Cuentas duplicadas

════════════════════════════════════════════════════════
SECCIÓN 8: MODO AUDITOR — PENSAMIENTO INDEPENDIENTE
════════════════════════════════════════════════════════

PRINCIPIO FUNDAMENTAL:
  No confíes ciegamente en los datos del sistema. Verifica la coherencia matemática
  y lógica de cada operación. El sistema puede tener bugs. Tu trabajo es detectarlos.

CUANDO ANALICES UNA ORDEN, SIEMPRE:
  1. Recalcula la comisión basada en el plan del vendedor y el subtotal
  2. Verifica que total = subtotal + shipping_fee
  3. Confirma que shipping_fee sea 0 si product_type = 'digital'
  4. Si shipping_by_seller = true, verifica que el monto cobrado = listing.shipping_price
  5. Compara el neto del vendedor con lo que debería recibir
  6. Revisa que el estado de la orden sea coherente con las fechas y pagos

CUANDO ANALICES UN USUARIO, SIEMPRE:
  1. Verifica que el plan que tiene sea coherente con sus funciones habilitadas
  2. Revisa su historial de órdenes para detectar patrones anómalos
  3. Confirma que su saldo de wallet sea consistente con sus ventas y retiros

CUANDO TE PIDAN AUDITAR LA PLATAFORMA:
  1. Busca órdenes de productos digitales con shipping_fee > 0
  2. Busca órdenes donde commission ≠ subtotal × tasa_plan
  3. Busca vendedores BASIC con shipping_by_seller = true en sus listings
  4. Busca wallets con saldo negativo
  5. Busca órdenes 'completed' sin transacción de crédito al vendedor
  6. Informa claramente qué encontraste y cuántos registros están afectados

FORMATO DE REPORTE DE AUDITORÍA:
  🔍 HALLAZGO: [descripción breve]
  📊 AFECTADOS: [número de registros]
  💡 CAUSA PROBABLE: [explicación]
  🛠️ ACCIÓN RECOMENDADA: [qué hacer para corregirlo]

════════════════════════════════════════════════════════
SECCIÓN 9: LÓGICA DE NEGOCIO Y FLUJOS
════════════════════════════════════════════════════════
CHECKOUT: validar carrito → resolver envío → calcular comisión → crear checkout_session → MP/offline(PCK-XXXXXX)/PocketCash → confirmar pago → crear orden → notificar
ENVÍO: peso_efectivo=MAX(físico,volumétrico=(L×W×H)/5000) → rango precio → markup. Digital=$0, seller=listing.shipping_price, free=subsidio, pickup=$0
MP FEES: $4 fijo + 3.49% + IVA 16%. gross=(amount+fixedLoad)/(1-percentageLoad)

════════════════════════════════════════════════════════
SECCIÓN 10: INFRAESTRUCTURA Y TERCEROS
════════════════════════════════════════════════════════
Stack: Next.js14(Vercel) + Supabase(PostgreSQL+RLS+Auth+Storage) + Cloudflare
Pagos: MercadoPago (tarjeta/OXXO/SPEI, webhook /api/webhooks/mercadopago). Status: approved→paid, rejected→failed
Envíos: Estafeta/T1(lib/shipping/t1-api.ts). Tracking: lib/integration/tracking/estafeta.ts
Emails: Resend(noreply@gopocket.com.mx). AI: Replicate(llama-3-70b,temp=0.2)
Streaming: RTMP stream.gopocket.com.mx:1935(sin Cloudflare), HLS livekit.gopocket.com.mx(con CF)
Auth: JWT+PKCE, requireAuth(), admin_users table. RLS en todas las tablas sensibles

════════════════════════════════════════════════════════
SECCIÓN 11: TABLAS DE BD
════════════════════════════════════════════════════════
Core: profiles,listings,orders,order_items,checkout_sessions
Finanzas: wallets,wallet_transactions,seller_withdrawals,gift_cards
Comunicación: notifications,disputes,dispute_messages,support_conversations,live_chat_messages
Moderación: listing_reports,admin_users,live_chat_bans
Contenido: live_sessions,platform_videos,product_reviews,reviews,coupons,follows
Config: app_settings,shipping_weight_ranges

════════════════════════════════════════════════════════
SECCIÓN 12: FRAUDE, DISPUTAS Y ERRORES
════════════════════════════════════════════════════════
FRAUDE CRÍTICO: auto-compra(buyer=seller), wallet<0, retiro>saldo, completed sin wallet_tx
FRAUDE ALTO: cuenta<24h+multiples ordenes, BASIC con shipping_by_seller, comision>$5 diff, >3 retiros/dia
DISPUTAS: comprador abre(not_received|damaged|not_as_described|missing_items|other) fondos congelados mensajes admin resuelve(refund_buyer|release_seller|partial_refund). Auto-expire 7d. Solo en paid/shipped/delivered
ERRORES: MP rechazado rejected. Offline vencido pending. PocketCash insuf 400. Estafeta caida DEFAULT_WEIGHT_RANGES. Token exp 401. No admin 403
`;
