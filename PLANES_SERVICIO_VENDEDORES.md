# Planes de Servicio para Vendedores - Propuesta

## 📋 Resumen

Propuesta de 3 planes de servicio diferenciados para vendedores, basados en las características existentes de la plataforma y mejores prácticas de marketplaces.

---

## 🎯 Planes Propuestos

### 1. Plan Básico (Gratis) - "Iniciador"

**Precio**: $0 MXN/mes

**Características**:
- ✅ **50 publicaciones activas** simultáneas
- ✅ **Comisión estándar**: 23% por venta
- ✅ **Publicaciones destacadas**: 3 permitidas (pago por uso)
- ✅ **Envío gratis**: No incluido (el vendedor paga)
- ✅ **Subastas**: Hasta 15 subastas activas simultáneas
- ✅ **Cupones**: Hasta 25 cupones activos
- ✅ **Retiros**: Cada 7 días (168 horas)
- ✅ **Soporte**: Email
- ✅ **Analytics básicos**: Ventas, vistas, conversión

**Ideal para**: Vendedores ocasionales, personas que venden de vez en cuando.

---

### 2. Plan Profesional ($299 MXN/mes) - "Vendedor Pro"

**Precio**: $299 MXN/mes

**Características**:
- ✅ **Publicaciones Ilimitadas**
- ✅ **Comisión reducida**: 18% por venta
- ✅ **Publicaciones destacadas**: 25 permitidas
- ✅ **Envío gratis**: Opción de envío por cuenta propia
- ✅ **Subastas**: Ilimitadas
- ✅ **Cupones**: Ilimitados
- ✅ **Retiros**: Cada 48 horas
- ✅ **Soporte prioritario**: Email (respuesta en 24 horas) + Chat
- ✅ **Analytics avanzados**: 
  - Ventas por período
  - Productos más vendidos
  - Tendencias de búsqueda
  - Análisis de competencia
- ✅ **Herramientas de marketing**:
  - Plantillas de publicaciones
  - Programación de publicaciones
  - Promociones automáticas
- ✅ **Badge "Vendedor Pro"**: Visible en tu perfil y publicaciones
- ✅ **Chat con compradores**: Incluido
- ✅ **Sistema de reputación**: Incluido

**Ideal para**: Vendedores activos, pequeños negocios, personas que venden regularmente.

**Ahorro estimado** (si vendes $10,000/mes):
- Comisión: $150 menos (de $500 a $350)
- 5 destacados: $125 ahorrados
- 3 envíos gratis: $540 ahorrados
- **Total ahorrado: ~$815 MXN/mes** (el plan cuesta $299)


---

## 📊 Comparativa Visual

| Característica | Básico | Profesional | Premium |
|----------------|--------|-------------|---------|
| **Precio/mes** | $0 | $299 | $799 |
| **Publicaciones activas** | 5 | 25 | Ilimitadas |
| **Comisión por venta** | 5% | 3.5% | 2% |
| **Destacados gratis/mes** | 0 | 5 | 15 |
| **Envíos gratis/mes** | 0 | 3 | 10 |
| **Subastas** | 2 activas | Ilimitadas | Ilimitadas |
| **Cupones** | 3 activos | Ilimitados | Ilimitados |
| **Soporte** | Email (48h) | Email+Chat (24h) | VIP (4h) |
| **Analytics** | Básico | Avanzado | Premium |
| **Herramientas marketing** | ❌ | ✅ | ✅✅ |
| **Posicionamiento** | Normal | Normal | Prioritario |
| **Badge especial** | ❌ | ✅ | ✅✅ |

---

## 💡 Características Adicionales que Podrías Ofrecer

### Para todos los planes:
- **Programa de referidos**: Gana créditos por referir nuevos vendedores
- **Descuentos por pago anual**: 15% de descuento si pagas 12 meses
- **Período de prueba**: 7 días gratis para planes de pago

### Solo Premium:
- **Webhook API**: Recibe notificaciones de ventas en tiempo real
- **Integración con sistemas externos**: Conecta con tu inventario/ERP
- **Múltiples usuarios**: Hasta 3 usuarios por cuenta (para equipos)
- **Facturación automática**: Genera facturas automáticamente

---

## 🎨 Implementación Técnica Sugerida

### 1. Tabla `seller_plans` (Nueva)

```sql
CREATE TABLE public.seller_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'professional', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id) -- Un plan activo por usuario
);
```

### 2. Tabla `seller_plan_usage` (Nueva)

```sql
CREATE TABLE public.seller_plan_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  month_year TEXT NOT NULL, -- "2026-01"
  featured_used INTEGER NOT NULL DEFAULT 0,
  free_shipping_used INTEGER NOT NULL DEFAULT 0,
  listings_active_count INTEGER NOT NULL DEFAULT 0,
  auctions_active_count INTEGER NOT NULL DEFAULT 0,
  coupons_active_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);
```

### 3. Modificar `listings` para validar límites

- Agregar validación al crear publicación: verificar límite de publicaciones activas
- Agregar validación al destacar: verificar si tiene destacados gratis disponibles

### 4. Modificar cálculo de comisiones

- En `app/api/checkout/create/route.ts`: usar comisión según plan del vendedor
- Crear función helper: `getSellerCommissionRate(userId)`

### 5. Página de suscripción

- `/dashboard/suscripcion`: Ver plan actual, cambiar plan, ver uso del mes
- Integración con MercadoPago para pagos recurrentes

---

## 📈 Estrategia de Precios Alternativa

Si $299/$799 te parecen altos, considera:

### Opción A: Precios más bajos
- **Profesional**: $199/mes
- **Premium**: $499/mes

### Opción B: Precios más altos con más beneficios
- **Profesional**: $399/mes (con más destacados gratis)
- **Premium**: $999/mes (con comisión 1.5%)

### Opción C: Pago anual con descuento
- **Profesional**: $299/mes o $2,990/año (17% descuento)
- **Premium**: $799/mes o $7,590/año (21% descuento)

---

## 🚀 Fases de Implementación

### Fase 1: Estructura Base
1. Crear tablas `seller_plans` y `seller_plan_usage`
2. Agregar validación de límites de publicaciones
3. Crear página `/dashboard/suscripcion`

### Fase 2: Comisiones y Beneficios
1. Implementar comisiones diferenciadas por plan
2. Sistema de destacados gratis
3. Sistema de envíos gratis incluidos

### Fase 3: Analytics y Herramientas
1. Analytics avanzados para Profesional
2. Analytics premium para Premium
3. Herramientas de marketing

### Fase 4: Integración de Pagos
1. Integración con MercadoPago para suscripciones
2. Webhooks para renovaciones automáticas
3. Gestión de cancelaciones

---

## 💬 Recomendaciones Finales

1. **Empezar simple**: Implementa primero el Plan Básico (gratis) y el Plan Profesional. Agrega Premium después.

2. **Período de prueba**: Ofrece 7-14 días gratis para planes de pago para reducir fricción.

3. **Onboarding**: Cuando un vendedor se registre, muéstrale claramente los beneficios de cada plan.

4. **Upsell inteligente**: Cuando un vendedor alcance el límite de publicaciones, sugiere actualizar al siguiente plan.

5. **Métricas**: Rastrea:
   - Conversión de Básico a Profesional/Premium
   - Tasa de cancelación
   - LTV (Lifetime Value) por plan
   - Uso de beneficios (destacados gratis, envíos gratis)

---

**¿Qué te parece esta propuesta?** ¿Quieres que ajuste algún plan o agregue/quite características?
